package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"dispatch-server/internal/models"
)

const (
	DefaultUserDailyGeminiLimit   = 15
	DefaultGlobalDailyGeminiLimit = 150
)

type AIService struct {
	toolService      *AIToolService
	httpClient       *http.Client
	quotaMu          sync.Mutex
	quotaDay         string
	userQuotaUsage   map[string]int
	globalQuotaUsage int
	userDailyLimit   int
	globalDailyLimit int
}

func NewAIService(toolService *AIToolService) *AIService {
	userLim := DefaultUserDailyGeminiLimit
	if v := strings.TrimSpace(os.Getenv("AI_DAILY_USER_LIMIT")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			userLim = n
		}
	}
	globalLim := DefaultGlobalDailyGeminiLimit
	if v := strings.TrimSpace(os.Getenv("AI_DAILY_GLOBAL_LIMIT")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			globalLim = n
		}
	}
	return &AIService{
		toolService:      toolService,
		httpClient:       &http.Client{Timeout: 30 * time.Second},
		quotaDay:         time.Now().UTC().Format("2006-01-02"),
		userQuotaUsage:   make(map[string]int),
		userDailyLimit:   userLim,
		globalDailyLimit: globalLim,
	}
}

func (s *AIService) ensureQuotaDayLocked() {
	today := time.Now().UTC().Format("2006-01-02")
	if s.quotaDay != today {
		s.quotaDay = today
		s.userQuotaUsage = make(map[string]int)
		s.globalQuotaUsage = 0
	}
}

// GetQuotaStatus returns current daily Gemini usage for a user without incrementing counters.
func (s *AIService) GetQuotaStatus(userKey string) (used int, limit int, remaining int, exhausted bool) {
	s.quotaMu.Lock()
	defer s.quotaMu.Unlock()
	s.ensureQuotaDayLocked()

	if userKey == "" {
		userKey = "anonymous"
	}
	used = s.userQuotaUsage[userKey]
	limit = s.userDailyLimit
	remaining = limit - used
	if remaining < 0 {
		remaining = 0
	}
	globalRem := s.globalDailyLimit - s.globalQuotaUsage
	if globalRem < remaining {
		if globalRem < 0 {
			remaining = 0
		} else {
			remaining = globalRem
		}
	}
	exhausted = remaining <= 0
	return
}

// ConsumeQuota checks if the user and global daily Gemini quota allow a call, and increments if allowed.
func (s *AIService) ConsumeQuota(userKey string) (used int, limit int, remaining int, allowed bool) {
	s.quotaMu.Lock()
	defer s.quotaMu.Unlock()
	s.ensureQuotaDayLocked()

	if userKey == "" {
		userKey = "anonymous"
	}
	limit = s.userDailyLimit
	current := s.userQuotaUsage[userKey]
	if current >= limit || s.globalQuotaUsage >= s.globalDailyLimit {
		return current, limit, 0, false
	}

	current++
	s.userQuotaUsage[userKey] = current
	s.globalQuotaUsage++
	rem := limit - current
	if rem < 0 {
		rem = 0
	}
	return current, limit, rem, true
}

func containsChinese(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

// resolveLanguage determines whether to respond in Chinese, French, or English.
func resolveLanguage(req *models.AIChatRequest) string {
	if strings.HasPrefix(strings.ToLower(req.Lang), "zh") {
		return "zh"
	}
	if strings.HasPrefix(strings.ToLower(req.Lang), "fr") {
		return "fr"
	}
	if strings.HasPrefix(strings.ToLower(req.Lang), "en") {
		return "en"
	}
	if containsChinese(req.Message) {
		return "zh"
	}
	lower := strings.ToLower(req.Message)
	frenchWords := []string{
		"bonjour", "salut", "chauffeur", "conducteur", "ligne", "circuit",
		"quart", "quarts", "aujourd'hui", "aucun", "combien",
		"horaire", "planning", "assigner", "affecter", "résumé", "aperçu",
		"manque", "confirmer", "annuler", "flotte",
	}
	for _, w := range frenchWords {
		if strings.Contains(lower, w) {
			return "fr"
		}
	}
	return "en"
}

// ProcessChat handles the chat request with dual-engine (Gemini function calling or built-in semantic engine)
func (s *AIService) ProcessChat(ctx context.Context, req *models.AIChatRequest) (*models.AIChatResponse, error) {
	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}

	lang := resolveLanguage(req)
	isFr := lang == "fr"
	isZh := lang == "zh"

	// 1. Check if user is confirming or canceling a pending action
	actID := req.ActionID
	if actID == "" {
		actID = req.ConfirmActionID
	}
	confirmed := req.Confirmed
	if req.ConfirmAccepted != nil {
		confirmed = *req.ConfirmAccepted
	}

	if actID != "" {
		if confirmed {
			if !CanModifyDispatchShifts(req.UserRole, req.PagePermissions) {
				failTitle := "Permission Denied"
				if isZh {
					failTitle = "权限不足"
				} else if isFr {
					failTitle = "Accès refusé"
				}
				failMsg := BuildDispatchModificationDeniedMessage(req.UserRole, lang)
				return &models.AIChatResponse{
					Reply: failMsg,
					ActionCards: []models.AIActionCard{
						{
							Type:  "action_cancelled",
							Title: failTitle,
							Data:  map[string]interface{}{"error": "insufficient_role_privileges"},
						},
					},
				}, nil
			}

			action, err := s.toolService.ExecutePendingAction(ctx, actID, req.OperatorID, req.OperatorName, req.UserRole, req.PagePermissions)
			if err != nil {
				failTitle := "Execution Failed"
				failMsg := fmt.Sprintf("❌ Confirmation failed: %s", err.Error())
				if isFr {
					failTitle = "Échec de l'exécution"
					failMsg = fmt.Sprintf("❌ Échec de la confirmation : %s", err.Error())
				}
				return &models.AIChatResponse{
					Reply: failMsg,
					ActionCards: []models.AIActionCard{
						{
							Type:  "action_cancelled",
							Title: failTitle,
							Data:  map[string]interface{}{"error": err.Error()},
						},
					},
				}, nil
			}

			var reply string
			var cardTitle string
			var suggested []string

			if action.ActionType == "CREATE_DISPATCH_SHEET" {
				if isFr {
					reply = fmt.Sprintf(
						"✅ **La feuille de régulation (Dispatch Sheet) a été créée avec succès pour le %s !**\n\n- **Date** : %s\n- Tous les quarts de régulation pour cette journée ont été générés selon les lignes actives.\n\nCette opération a été consignée dans le journal d'audit (`dispatch_change_logs`).",
						action.Date, action.Date,
					)
					cardTitle = "Feuille de régulation créée"
					suggested = []string{
						"Quels quarts n'ont pas de chauffeur aujourd'hui ?",
						"Voir la vue d'ensemble du dispatch",
					}
				} else if isZh {
					reply = fmt.Sprintf(
						"✅ **已成功为 %s 创建每日调度表！**\n\n- **日期**：%s\n- 已从当前激活主路线自动生成排班数据并完成同步。\n\n该操作已记录在调度审计日志 (`dispatch_change_logs`) 中。",
						action.Date, action.Date,
					)
					cardTitle = "调度表已创建"
					suggested = []string{
						"今天有哪些班次缺少司机？",
						"查看今日调度总览",
					}
				} else {
					reply = fmt.Sprintf(
						"✅ **Daily Dispatch Sheet successfully created for %s!**\n\n- **Date**: %s\n- Daily shifts have been generated and synchronized from active master routes.\n\nThis operation has been recorded in the Dispatch Audit Log (`dispatch_change_logs`).",
						action.Date, action.Date,
					)
					cardTitle = "Dispatch Sheet Created"
					suggested = []string{
						"Which shifts have no driver today?",
						"View today's dispatch overview",
					}
				}

				return &models.AIChatResponse{
					Reply: reply,
					ActionCards: []models.AIActionCard{
						{
							Type:     "action_success",
							Title:    cardTitle,
							ActionID: action.ID,
							Data: map[string]interface{}{
								"actionType": action.ActionType,
								"date":       action.Date,
							},
						},
					},
					SuggestedQuestions: suggested,
				}, nil
			}

			if isZh {
				reply = fmt.Sprintf(
					"✅ **调度指派操作已成功执行并保存！**\n\n- **路线**：%s (%s)\n- **日期**：%s (%s)\n- **指派司机**：%s (%s)\n\n该操作已记入调度变更审计日志 (`dispatch_change_logs`)。",
					action.RouteNo, action.RouteName, action.Date, action.ShiftType, action.DriverName, action.DriverID,
				)
				cardTitle = "排班已更新"
				suggested = []string{
					"今天有哪些班次缺少司机？",
					"查看今日调度总览",
				}
			} else if isFr {
				reply = fmt.Sprintf(
					"✅ **L'affectation de régulation a été exécutée et enregistrée avec succès !**\n\n- **Ligne** : %s (%s)\n- **Date** : %s (%s)\n- **Chauffeur assigné** : %s (%s)\n\nCette opération a été consignée dans le journal d'audit de régulation (`dispatch_change_logs`).",
					action.RouteNo, action.RouteName, action.Date, action.ShiftType, action.DriverName, action.DriverID,
				)
				cardTitle = "Horaire mis à jour"
				suggested = []string{
					"Quels quarts n'ont pas de chauffeur aujourd'hui ?",
					"Voir la vue d'ensemble du dispatch",
				}
			} else {
				reply = fmt.Sprintf(
					"✅ **Dispatch assignment successfully executed and saved!**\n\n- **Route**: %s (%s)\n- **Date**: %s (%s)\n- **Assigned Driver**: %s (%s)\n\nThis operation has been recorded in the Dispatch Audit Log (`dispatch_change_logs`).",
					action.RouteNo, action.RouteName, action.Date, action.ShiftType, action.DriverName, action.DriverID,
				)
				cardTitle = "Schedule Updated"
				suggested = []string{
					"Which shifts have no driver today?",
					"View today's dispatch overview",
				}
			}

			return &models.AIChatResponse{
				Reply: reply,
				ActionCards: []models.AIActionCard{
					{
						Type:     "action_success",
						Title:    cardTitle,
						ActionID: action.ID,
						Data: map[string]interface{}{
							"routeNo":    action.RouteNo,
							"routeName":  action.RouteName,
							"date":       action.Date,
							"shiftType":  action.ShiftType,
							"driverName": action.DriverName,
							"driverId":   action.DriverID,
						},
					},
				},
				SuggestedQuestions: suggested,
			}, nil
		} else {
			cancelReply := "Dispatch action cancelled. No changes have been made to the schedule."
			cancelTitle := "Action Cancelled"
			if isZh {
				cancelReply = "调度操作已取消，未对排班计划做任何变更。"
				cancelTitle = "操作已取消"
			} else if isFr {
				cancelReply = "L'opération de régulation a été annulée. Aucune modification n'a été apportée aux horaires."
				cancelTitle = "Opération annulée"
			}
			return &models.AIChatResponse{
				Reply: cancelReply,
				ActionCards: []models.AIActionCard{
					{
						Type:  "action_cancelled",
						Title: cancelTitle,
					},
				},
			}, nil
		}
	}

	trimmedMsg := strings.TrimSpace(req.Message)
	if trimmedMsg == "" {
		roleNorm := NormalizeRole(req.UserRole)
		var welcomeMsg string
		var welcomeQuestions []string

		switch roleNorm {
		case "HR":
			if isZh {
				welcomeMsg = "您好！我是您的校车运营 AI 助手。作为 **人事 (HR)**，您可以查询员工档案、跟进驾驶证与资质合规，以及查看车队车辆状态。*(注：班次修改权限仅限调度员)*"
				welcomeQuestions = []string{
					"员工档案与资质合规概览",
					"查看车队车辆状态",
					"今日校车调度总览",
				}
			} else if isFr {
				welcomeMsg = "Bonjour ! Je suis votre Copilote IA. En tant que **RH**, vous pouvez consulter l'annuaire du personnel, vérifier la conformité des permis de conduire et inspecter la flotte. *(Note : La modification des quarts de régulation est réservée aux régulateurs)*."
				welcomeQuestions = []string{
					"Résumé des employés et conformité RH",
					"Statut de la flotte de véhicules",
					"Aperçu de la régulation",
				}
			} else {
				welcomeMsg = "Hello! I am your AI Operations Copilot. In your **HR** role, you can inspect staff personnel records, track driver license compliance, and view fleet status. *(Note: Shift assignment modifications are restricted to Dispatchers)*."
				welcomeQuestions = []string{
					"HR staff summary & active employees",
					"Vehicle fleet status",
					"View today's dispatch overview",
				}
			}
		case "payroll":
			if isZh {
				welcomeMsg = "您好！我是您的校车运营 AI 助手。作为 **薪酬/财务 (Payroll)**，您可以查询薪酬费率、路线计费标准与排班工时统计。*(注：班次修改权限仅限调度员)*"
				welcomeQuestions = []string{
					"薪资与排班工时汇总",
					"今日校车调度总览",
					"查看车队车辆状态",
				}
			} else if isFr {
				welcomeMsg = "Bonjour ! Je suis votre Copilote IA. En tant que responsable **Paie**, vous pouvez consulter les grilles de taux, les barèmes des lignes et les statistiques opérationnelles. *(Note : La modification des quarts est réservée aux régulateurs)*."
				welcomeQuestions = []string{
					"Synthèse des taux de rémunération et de paie",
					"Aperçu de la régulation",
					"Statut de la flotte de véhicules",
				}
			} else {
				welcomeMsg = "Hello! I am your AI Operations Copilot. In your **Payroll** role, you can review compensation rates, school board tiers, and operational shift overviews. *(Note: Shift modifications are restricted to Dispatchers)*."
				welcomeQuestions = []string{
					"Payroll & compensation rates summary",
					"View today's dispatch overview",
					"Vehicle fleet status",
				}
			}
		default:
			if isZh {
				welcomeMsg = "您好！我是您的校车调度 AI 助手。您可以向我询问空缺班次、司机排班，或者直接安排调度指派。"
				welcomeQuestions = []string{
					"今天有哪些班次缺少司机？",
					"查看车队车辆状态",
					"今日校车调度总览",
				}
			} else if isFr {
				welcomeMsg = "Bonjour ! Je suis votre Copilote IA de régulation. Vous pouvez me poser des questions sur les quarts vacants, les horaires des chauffeurs ou m'ordonner d'assigner un chauffeur."
				welcomeQuestions = []string{
					"Quels quarts n'ont pas de chauffeur aujourd'hui ?",
					"Statut de la flotte de véhicules",
					"Aperçu de la régulation",
				}
			} else {
				welcomeMsg = "Hello! I am your AI Dispatch Copilot. You can ask me about shift vacancies, driver schedules, or direct me to assign drivers to routes."
				welcomeQuestions = []string{
					"Which shifts have no driver today?",
					"Vehicle fleet status",
					"View today's dispatch overview",
				}
			}
		}

		return &models.AIChatResponse{
			Reply:              welcomeMsg,
			SuggestedQuestions: welcomeQuestions,
		}, nil
	}

	// 2. Smart Routing: First try the zero-cost Built-in Semantic Engine for structured Dispatch/Fleet/HR/Payroll queries
	resp, err := s.processWithBuiltinEngine(ctx, req, lang)
	if err != nil {
		return nil, err
	}

	userQuotaKey := strings.TrimSpace(req.OperatorID)
	if userQuotaKey == "" {
		userQuotaKey = strings.TrimSpace(req.OperatorName)
	}

	// If the built-in engine matched a specific operational tool, return immediately (0 Gemini tokens used)
	if resp.Engine != "builtin_fallback" {
		used, limit, rem, exh := s.GetQuotaStatus(userQuotaKey)
		resp.Engine = "builtin"
		resp.QuotaUsed = used
		resp.QuotaLimit = limit
		resp.QuotaRemaining = rem
		resp.QuotaExhausted = exh
		return resp, nil
	}

	// 3. For unmatched/complex conversational prompts, invoke Gemini LLM if GEMINI_API_KEY is configured and user is authenticated
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey != "" && strings.TrimSpace(req.OperatorID) != "" {
		used, limit, rem, allowed := s.ConsumeQuota(userQuotaKey)
		if allowed {
			geminiResp, gemErr := s.processWithGemini(ctx, req, geminiKey, lang)
			if gemErr == nil && geminiResp != nil {
				geminiResp.Engine = "gemini"
				geminiResp.QuotaUsed = used
				geminiResp.QuotaLimit = limit
				geminiResp.QuotaRemaining = rem
				geminiResp.QuotaExhausted = rem <= 0
				return geminiResp, nil
			}
		} else {
			resp.QuotaUsed = used
			resp.QuotaLimit = limit
			resp.QuotaRemaining = 0
			resp.QuotaExhausted = true
			if isZh {
				resp.Reply += fmt.Sprintf("\n\n---\n⚡ *今日 Gemini AI 配额已达上限 (%d/%d 次)。已由内置免费语义引擎继续为您服务。*", used, limit)
			} else if isFr {
				resp.Reply += fmt.Sprintf("\n\n---\n⚡ *Quota quotidien Gemini IA atteint (%d/%d appels aujourd'hui). Réponse fournie par le moteur sémantique intégré gratuit.*", used, limit)
			} else {
				resp.Reply += fmt.Sprintf("\n\n---\n⚡ *Daily Gemini AI quota reached (%d/%d calls today). Answered via the free Built-in Semantic Engine.*", used, limit)
			}
			resp.Engine = "builtin"
			return resp, nil
		}
	}

	used, limit, rem, exh := s.GetQuotaStatus(userQuotaKey)
	resp.Engine = "builtin"
	resp.QuotaUsed = used
	resp.QuotaLimit = limit
	resp.QuotaRemaining = rem
	resp.QuotaExhausted = exh
	return resp, nil
}

// processWithBuiltinEngine provides high-accuracy zero-configuration parsing in English, French or Chinese
func (s *AIService) processWithBuiltinEngine(ctx context.Context, req *models.AIChatRequest, lang string) (*models.AIChatResponse, error) {
	msg := strings.TrimSpace(req.Message)
	date := req.Date
	isFr := lang == "fr"
	isZh := lang == "zh"

	// Check if message explicitly mentions another date (e.g., "2026-09-25")
	dateRegex := regexp.MustCompile(`(\d{4}-\d{2}-\d{2})`)
	if m := dateRegex.FindString(msg); m != "" {
		date = m
	}

	lowerMsg := strings.ToLower(msg)

	// Pattern A: Unassigned shifts query
	isUnassignedQuery := strings.Contains(lowerMsg, "unassigned") ||
		strings.Contains(lowerMsg, "no driver") ||
		strings.Contains(lowerMsg, "missing driver") ||
		strings.Contains(lowerMsg, "open shift") ||
		strings.Contains(lowerMsg, "vacant") ||
		strings.Contains(lowerMsg, "without driver") ||
		strings.Contains(lowerMsg, "sans chauffeur") ||
		strings.Contains(lowerMsg, "aucun chauffeur") ||
		strings.Contains(lowerMsg, "pas de chauffeur") ||
		strings.Contains(lowerMsg, "sans conducteur") ||
		strings.Contains(lowerMsg, "non assigné") ||
		strings.Contains(lowerMsg, "non assigne") ||
		strings.Contains(lowerMsg, "manque chauffeur") ||
		// Fallbacks for legacy queries
		strings.Contains(msg, "没有司机") ||
		strings.Contains(msg, "缺司机") ||
		strings.Contains(msg, "未分配") ||
		strings.Contains(msg, "缺人") ||
		(strings.Contains(msg, "哪个") && strings.Contains(msg, "shift"))

	if isUnassignedQuery {
		unassigned, err := s.toolService.GetUnassignedShifts(ctx, date, req.YardFilter)
		if err != nil {
			return nil, err
		}

		if len(unassigned) == 0 {
			if isZh {
				return &models.AIChatResponse{
					Reply: fmt.Sprintf("🎉 在 **%s**，所有班次均已安排司机，没有缺司机的空缺班次！", date),
					SuggestedQuestions: []string{
						"查看今日调度总览",
						"查看车队车辆状态",
					},
				}, nil
			}
			if isFr {
				return &models.AIChatResponse{
					Reply: fmt.Sprintf("🎉 Pour la date du **%s**, tous les quarts ont un chauffeur assigné. Aucun quart vacant trouvé !", date),
					SuggestedQuestions: []string{
						"Voir la vue d'ensemble du dispatch",
						"Quarts de Tom",
					},
				}, nil
			}
			return &models.AIChatResponse{
				Reply: fmt.Sprintf("🎉 On **%s**, all shifts have assigned drivers. No vacant shifts found!", date),
				SuggestedQuestions: []string{
					"View today's dispatch overview",
					"Tom's schedule",
				},
			}, nil
		}

		cardList := make([]map[string]interface{}, 0, len(unassigned))
		var lines []string

		if isZh {
			lines = []string{fmt.Sprintf("⚠️ 在 **%s**，共有 **%d** 个班次未指派司机：\n", date, len(unassigned))}
			for i, sh := range unassigned {
				lines = append(lines, fmt.Sprintf("%d. **路线 `%s`** (%s) · 班次 **%s** · 首站发车：`%s`", i+1, sh.RouteNo, sh.RouteName, sh.ShiftType, sh.FirstStopTime))
				cardList = append(cardList, map[string]interface{}{
					"shiftId":       sh.ID,
					"routeNo":       sh.RouteNo,
					"routeName":     sh.RouteName,
					"shiftType":     sh.ShiftType,
					"firstStopTime": sh.FirstStopTime,
					"yardName":      sh.YardName,
				})
			}
			lines = append(lines, "\n您可以直接对我说：*“把 Tom 指派到路线 "+unassigned[0].RouteNo+"”* 即可一键分配。")

			return &models.AIChatResponse{
				Reply: strings.Join(lines, "\n"),
				ActionCards: []models.AIActionCard{
					{
						Type:  "unassigned_shifts",
						Title: fmt.Sprintf("未分配班次 (%d)", len(unassigned)),
						Data: map[string]interface{}{
							"date":   date,
							"shifts": cardList,
						},
					},
				},
				SuggestedQuestions: []string{
					fmt.Sprintf("把 Tom 指派到路线 %s", unassigned[0].RouteNo),
					"查看今日调度总览",
				},
			}, nil
		}

		if isFr {
			lines = []string{fmt.Sprintf("⚠️ Le **%s**, **%d** quart(s) n'ont pas de chauffeur assigné :\n", date, len(unassigned))}
			for i, sh := range unassigned {
				lines = append(lines, fmt.Sprintf("%d. **Ligne `%s`** (%s) · Quart **%s** · Premier arrêt : `%s`", i+1, sh.RouteNo, sh.RouteName, sh.ShiftType, sh.FirstStopTime))
				cardList = append(cardList, map[string]interface{}{
					"shiftId":       sh.ID,
					"routeNo":       sh.RouteNo,
					"routeName":     sh.RouteName,
					"shiftType":     sh.ShiftType,
					"firstStopTime": sh.FirstStopTime,
					"yardName":      sh.YardName,
				})
			}
			lines = append(lines, "\nVous pouvez m'ordonner directement : *“Assigner [Chauffeur] sur la ligne [Ligne]”* pour affecter en un clic.")

			return &models.AIChatResponse{
				Reply: strings.Join(lines, "\n"),
				ActionCards: []models.AIActionCard{
					{
						Type:  "unassigned_shifts",
						Title: fmt.Sprintf("Quarts non assignés (%d)", len(unassigned)),
						Data: map[string]interface{}{
							"date":   date,
							"shifts": cardList,
						},
					},
				},
				SuggestedQuestions: []string{
					fmt.Sprintf("Assigner Tom sur la ligne %s", unassigned[0].RouteNo),
					"Voir la vue d'ensemble du dispatch",
				},
			}, nil
		}

		// English response
		lines = []string{fmt.Sprintf("⚠️ On **%s**, found **%d** shift(s) without an assigned driver:\n", date, len(unassigned))}
		for i, sh := range unassigned {
			lines = append(lines, fmt.Sprintf("%d. **Route `%s`** (%s) · **%s** Shift · First Stop: `%s`", i+1, sh.RouteNo, sh.RouteName, sh.ShiftType, sh.FirstStopTime))
			cardList = append(cardList, map[string]interface{}{
				"shiftId":       sh.ID,
				"routeNo":       sh.RouteNo,
				"routeName":     sh.RouteName,
				"shiftType":     sh.ShiftType,
				"firstStopTime": sh.FirstStopTime,
				"yardName":      sh.YardName,
			})
		}
		lines = append(lines, "\nYou can tell me directly: *“Assign [Driver] to route [Route]”* to initiate an assignment.")

		return &models.AIChatResponse{
			Reply: strings.Join(lines, "\n"),
			ActionCards: []models.AIActionCard{
				{
					Type:  "unassigned_shifts",
					Title: fmt.Sprintf("Unassigned Shifts (%d)", len(unassigned)),
					Data: map[string]interface{}{
						"date":   date,
						"shifts": cardList,
					},
				},
			},
			SuggestedQuestions: []string{
				fmt.Sprintf("Assign Tom to route %s", unassigned[0].RouteNo),
				"View today's dispatch overview",
			},
		}, nil
	}

	// Pattern B0: Who Created Dispatch Query ("who created dispatch today?")
	isWhoCreatedDispatchQuery := strings.Contains(lowerMsg, "who created dispatch") ||
		strings.Contains(lowerMsg, "who created the dispatch") ||
		strings.Contains(lowerMsg, "who created today's dispatch") ||
		strings.Contains(lowerMsg, "who created this dispatch") ||
		strings.Contains(lowerMsg, "who generated dispatch") ||
		strings.Contains(lowerMsg, "who generated the dispatch") ||
		strings.Contains(lowerMsg, "who generated today's dispatch") ||
		strings.Contains(lowerMsg, "who made dispatch") ||
		strings.Contains(lowerMsg, "who made the dispatch") ||
		strings.Contains(lowerMsg, "who made today's dispatch") ||
		strings.Contains(lowerMsg, "who created sheet") ||
		strings.Contains(lowerMsg, "who created the sheet") ||
		strings.Contains(lowerMsg, "who dispatched today") ||
		strings.Contains(lowerMsg, "who started dispatch") ||
		(strings.Contains(lowerMsg, "who") && strings.Contains(lowerMsg, "created") && strings.Contains(lowerMsg, "dispatch")) ||
		(strings.Contains(lowerMsg, "who") && strings.Contains(lowerMsg, "generated") && strings.Contains(lowerMsg, "dispatch")) ||
		strings.Contains(lowerMsg, "qui a créé le dispatch") ||
		strings.Contains(lowerMsg, "qui a cree le dispatch") ||
		strings.Contains(lowerMsg, "qui a créé la feuille") ||
		strings.Contains(lowerMsg, "qui a cree la feuille") ||
		strings.Contains(lowerMsg, "qui a généré le dispatch") ||
		strings.Contains(lowerMsg, "qui a genere le dispatch") ||
		strings.Contains(lowerMsg, "qui a créé la journée") ||
		strings.Contains(lowerMsg, "qui a cree la journee") ||
		strings.Contains(msg, "谁创建了dispatch") ||
		strings.Contains(msg, "谁创建的dispatch") ||
		strings.Contains(msg, "谁生成的dispatch") ||
		strings.Contains(msg, "谁创建了今天的调度") ||
		strings.Contains(msg, "谁创建的调度") ||
		strings.Contains(msg, "谁建的调度") ||
		strings.Contains(msg, "谁生成的调度") ||
		strings.Contains(msg, "谁排的班") ||
		(strings.Contains(msg, "谁") && (strings.Contains(msg, "创建") || strings.Contains(msg, "生成")) && strings.Contains(strings.ToLower(msg), "dispatch")) ||
		(strings.Contains(msg, "谁") && (strings.Contains(msg, "创建") || strings.Contains(msg, "生成")) && strings.Contains(msg, "调度"))

	if isWhoCreatedDispatchQuery {
		targetDate := date
		if strings.Contains(lowerMsg, "yesterday") || strings.Contains(lowerMsg, "hier") || strings.Contains(msg, "昨天") {
			targetDate = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		} else if strings.Contains(lowerMsg, "tomorrow") || strings.Contains(lowerMsg, "demain") || strings.Contains(msg, "明天") {
			targetDate = time.Now().AddDate(0, 0, 1).Format("2006-01-02")
		}

		reply, card, err := s.toolService.GetDispatchCreatorInfo(ctx, targetDate, lang)
		if err != nil {
			errPrefix := "⚠️ Failed to retrieve dispatch creator information:"
			if isFr {
				errPrefix = "⚠️ Impossible de récupérer les informations de création du dispatch :"
			}
			return &models.AIChatResponse{
				Reply: fmt.Sprintf("%s %s", errPrefix, err.Error()),
			}, nil
		}

		var cards []models.AIActionCard
		if card != nil {
			cards = append(cards, *card)
		}

		suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
		if isFr {
			suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
		}

		return &models.AIChatResponse{
			Reply:              reply,
			ActionCards:        cards,
			SuggestedQuestions: suggested,
		}, nil
	}

	// Pattern B1: Create Dispatch Sheet / Generate Day
	isCreateSheetQuery := strings.Contains(lowerMsg, "create dispatch sheet") ||
		strings.Contains(lowerMsg, "generate dispatch sheet") ||
		strings.Contains(lowerMsg, "create dispatch day") ||
		strings.Contains(lowerMsg, "generate dispatch day") ||
		strings.Contains(lowerMsg, "create dispatch") ||
		strings.Contains(lowerMsg, "generate dispatch") ||
		strings.Contains(lowerMsg, "create sheet") ||
		strings.Contains(lowerMsg, "create day") ||
		strings.Contains(lowerMsg, "dispatch sheet") ||
		strings.Contains(lowerMsg, "créer la feuille de régulation") ||
		strings.Contains(lowerMsg, "creer la feuille de regulation") ||
		strings.Contains(lowerMsg, "créer la feuille de dispatch") ||
		strings.Contains(lowerMsg, "creer la feuille de dispatch") ||
		strings.Contains(lowerMsg, "générer le dispatch") ||
		strings.Contains(lowerMsg, "generer le dispatch") ||
		strings.Contains(lowerMsg, "générer la journée") ||
		strings.Contains(lowerMsg, "generer la journee") ||
		strings.Contains(lowerMsg, "créer les quarts") ||
		strings.Contains(lowerMsg, "creer les quarts") ||
		strings.Contains(lowerMsg, "feuille de régulation") ||
		strings.Contains(lowerMsg, "feuille de dispatch") ||
		strings.Contains(msg, "创建dispatch") ||
		strings.Contains(msg, "创建 dispatch") ||
		strings.Contains(msg, "生成dispatch") ||
		strings.Contains(msg, "生成 dispatch") ||
		strings.Contains(msg, "创建调度表") ||
		strings.Contains(msg, "生成调度表") ||
		strings.Contains(msg, "创建排班") ||
		strings.Contains(msg, "生成排班") ||
		strings.Contains(msg, "创建派车单") ||
		(strings.Contains(msg, "创建") && strings.Contains(strings.ToLower(msg), "dispatch")) ||
		(strings.Contains(msg, "生成") && strings.Contains(strings.ToLower(msg), "dispatch"))

	if isCreateSheetQuery {
		if !CanModifyDispatchShifts(req.UserRole, req.PagePermissions) {
			denialMsg := BuildDispatchModificationDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		targetDate := date
		if strings.Contains(lowerMsg, "tomorrow") || strings.Contains(lowerMsg, "demain") || strings.Contains(msg, "明天") {
			targetDate = time.Now().AddDate(0, 0, 1).Format("2006-01-02")
		}

		action, summaryMsg, err := s.toolService.PrepareCreateDispatchSheet(ctx, targetDate, req.OperatorName, req.UserRole, req.PagePermissions, lang)
		if err != nil {
			errPrefix := "⚠️ Could not prepare dispatch sheet creation:"
			if isFr {
				errPrefix = "⚠️ Impossible de préparer la création de la feuille de régulation :"
			}
			return &models.AIChatResponse{
				Reply: fmt.Sprintf("%s %s", errPrefix, err.Error()),
			}, nil
		}

		cardTitle := "Create Dispatch Sheet Confirmation"
		suggested := []string{"Confirm", "Cancel"}
		if isFr {
			cardTitle = "Confirmation création feuille de régulation"
			suggested = []string{"Confirmer", "Annuler"}
		}

		return &models.AIChatResponse{
			Reply: summaryMsg,
			ActionCards: []models.AIActionCard{
				{
					Type:        "confirm_action",
					Title:       cardTitle,
					ActionID:    action.ID,
					RequiresAck: true,
					Data: map[string]interface{}{
						"actionId":   action.ID,
						"actionType": action.ActionType,
						"date":       action.Date,
						"routeNo":    action.RouteNo,
						"routeName":  action.RouteName,
					},
				},
			},
			SuggestedQuestions: suggested,
		}, nil
	}

	// Pattern B2: Temporary Assignments Query (Substitutes)
	isTempAssignmentQuery := strings.Contains(lowerMsg, "temporary assignment") ||
		strings.Contains(lowerMsg, "temporary assignments") ||
		strings.Contains(lowerMsg, "temp assignment") ||
		strings.Contains(lowerMsg, "temp assignments") ||
		strings.Contains(lowerMsg, "substitute") ||
		strings.Contains(lowerMsg, "substitutes") ||
		strings.Contains(lowerMsg, "substitute driver") ||
		strings.Contains(lowerMsg, "substitute drivers") ||
		strings.Contains(lowerMsg, "active substitutes") ||
		strings.Contains(lowerMsg, "affectation temporaire") ||
		strings.Contains(lowerMsg, "affectations temporaires") ||
		strings.Contains(lowerMsg, "remplacement temporaire") ||
		strings.Contains(lowerMsg, "remplacements temporaires") ||
		strings.Contains(lowerMsg, "remplaçant") ||
		strings.Contains(lowerMsg, "remplacant") ||
		strings.Contains(msg, "临时调派") ||
		strings.Contains(msg, "临时分配") ||
		strings.Contains(msg, "替班") ||
		strings.Contains(msg, "代班")

	if isTempAssignmentQuery {
		reply, card, err := s.toolService.GetTemporaryAssignmentsSummary(ctx, date, lang)
		if err != nil {
			errPrefix := "⚠️ Failed to retrieve temporary assignments:"
			if isFr {
				errPrefix = "⚠️ Impossible de récupérer les affectations temporaires :"
			}
			return &models.AIChatResponse{
				Reply: fmt.Sprintf("%s %s", errPrefix, err.Error()),
			}, nil
		}

		var cards []models.AIActionCard
		if card != nil {
			cards = append(cards, *card)
		}

		suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
		if isFr {
			suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
		}

		return &models.AIChatResponse{
			Reply:              reply,
			ActionCards:        cards,
			SuggestedQuestions: suggested,
		}, nil
	}

	// Pattern B3: Assignment Overview / Status Query
	isAssignmentSummaryQuery := strings.Contains(lowerMsg, "assignment summary") ||
		strings.Contains(lowerMsg, "assignments summary") ||
		strings.Contains(lowerMsg, "assignment status") ||
		strings.Contains(lowerMsg, "assignments status") ||
		strings.Contains(lowerMsg, "today's assignments") ||
		strings.Contains(lowerMsg, "todays assignments") ||
		strings.Contains(lowerMsg, "today assignment") ||
		strings.Contains(lowerMsg, "shift assignments") ||
		strings.Contains(lowerMsg, "dispatch assignments") ||
		strings.Contains(lowerMsg, "quarts assignés") ||
		strings.Contains(lowerMsg, "état des affectations") ||
		strings.Contains(lowerMsg, "etat des affectations") ||
		strings.Contains(msg, "今日校车调度总览") ||
		strings.Contains(msg, "校车调度总览") ||
		strings.Contains(msg, "今日调度总览") ||
		strings.Contains(msg, "调度总览") ||
		strings.Contains(msg, "今日总览") ||
		strings.Contains(msg, "排班总览") ||
		strings.Contains(msg, "派班总览") ||
		strings.Contains(msg, "派班情况") ||
		strings.Contains(msg, "分配情况") ||
		strings.Contains(msg, "今天派班") ||
		strings.Contains(msg, "排班情况") ||
		strings.Contains(msg, "班次分配") ||
		(strings.Contains(msg, "总览") && !strings.Contains(msg, "车") && !strings.Contains(msg, "假") && !strings.Contains(msg, "费") && !strings.Contains(msg, "报销") && !strings.Contains(msg, "薪") && !strings.Contains(msg, "工") && !strings.Contains(msg, "路线"))

	if isAssignmentSummaryQuery {
		reply, card, err := s.toolService.GetAssignmentSummary(ctx, date, lang)
		if err != nil {
			errPrefix := "⚠️ Failed to retrieve assignment overview:"
			if isZh {
				errPrefix = "⚠️ 获取排班派班总览失败："
			} else if isFr {
				errPrefix = "⚠️ Impossible de récupérer l'aperçu des affectations :"
			}
			return &models.AIChatResponse{
				Reply: fmt.Sprintf("%s %s", errPrefix, err.Error()),
			}, nil
		}

		var cards []models.AIActionCard
		if card != nil {
			cards = append(cards, *card)
		}

		suggested := []string{"Which shifts have no driver today?", "Temporary assignments"}
		if isFr {
			suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Affectations temporaires"}
		} else if isZh {
			suggested = []string{"今天有哪些路线缺司机？", "查看车队车辆状态"}
		}

		return &models.AIChatResponse{
			Reply:              reply,
			ActionCards:        cards,
			SuggestedQuestions: suggested,
		}, nil
	}

	// Pattern B: Assign Driver instruction
	assignRouteToDriverEn := regexp.MustCompile(`(?i)(?:assign|schedule|put|set)\s+(?:route|line)\s+([a-zA-Z0-9_\-]+)\s+(?:to|for)\s+([a-zA-Z0-9_\-\.\s]+)`)
	assignRegexEn := regexp.MustCompile(`(?i)(?:assign|schedule|put|set)\s+([a-zA-Z0-9_\-\.\s]+?)\s+(?:to|on|for|as driver on)\s+(?:route|line)?\s*([a-zA-Z0-9_\-]+)`)
	assignRouteToDriverFr := regexp.MustCompile(`(?i)(?:assigner|affecter|mettre)\s+(?:la\s+ligne|la\s+route|le\s+circuit)\s+([a-zA-Z0-9_\-]+)\s+(?:à|a|pour)\s+([a-zA-Z0-9_\-\.\s]+)`)
	assignRegexFr := regexp.MustCompile(`(?i)(?:assigner|affecter|mettre)\s+([a-zA-Z0-9_\-\.\s]+?)\s+(?:sur|à|a|pour)\s+(?:la\s+ligne|la\s+route|le\s+circuit)?\s*([a-zA-Z0-9_\-]+)`)
	assignRouteToDriverZh1 := regexp.MustCompile(`(?i)(?:把|将)?\s*线路\s*([a-zA-Z0-9_\-]+)\s*(?:分配给|指派给|安排给|分给)\s*([a-zA-Z0-9_\-\.\x{4e00}-\x{9fa5}\s]+)`)
	assignRouteToDriverZh2 := regexp.MustCompile(`(?i)(?:把|将)?\s*([a-zA-Z0-9_\-]+)\s*(?:号?线路)\s*(?:分配给|指派给|安排给|分给)\s*([a-zA-Z0-9_\-\.\x{4e00}-\x{9fa5}\s]+)`)
	assignRegexZh := regexp.MustCompile(`(?i)(?:安排|分配|设置|指派|把|将)\s*([a-zA-Z0-9_\-\.\x{4e00}-\x{9fa5}\s]+?)\s*(?:在|到|给|去)?\s*线路\s*([a-zA-Z0-9_\-]+)\s*(?:当司机|开车|上班)?`)

	var driverQuery, routeQuery string
	if m := assignRouteToDriverEn.FindStringSubmatch(msg); len(m) >= 3 {
		routeQuery = strings.TrimSpace(m[1])
		driverQuery = strings.TrimSpace(m[2])
	} else if m := assignRegexEn.FindStringSubmatch(msg); len(m) >= 3 {
		driverQuery = strings.TrimSpace(m[1])
		routeQuery = strings.TrimSpace(m[2])
	} else if m := assignRouteToDriverFr.FindStringSubmatch(msg); len(m) >= 3 {
		routeQuery = strings.TrimSpace(m[1])
		driverQuery = strings.TrimSpace(m[2])
	} else if m := assignRegexFr.FindStringSubmatch(msg); len(m) >= 3 {
		driverQuery = strings.TrimSpace(m[1])
		routeQuery = strings.TrimSpace(m[2])
	} else if m := assignRouteToDriverZh1.FindStringSubmatch(msg); len(m) >= 3 && !strings.Contains(m[2], "谁") && !strings.Contains(m[2], "哪个") {
		routeQuery = strings.TrimSpace(m[1])
		driverQuery = strings.TrimSpace(m[2])
	} else if m := assignRouteToDriverZh2.FindStringSubmatch(msg); len(m) >= 3 && !strings.Contains(m[2], "谁") && !strings.Contains(m[2], "哪个") {
		routeQuery = strings.TrimSpace(m[1])
		driverQuery = strings.TrimSpace(m[2])
	} else if m := assignRegexZh.FindStringSubmatch(msg); len(m) >= 3 && !strings.Contains(m[1], "谁") && !strings.Contains(m[1], "哪个") {
		driverQuery = strings.TrimSpace(m[1])
		routeQuery = strings.TrimSpace(m[2])
	}

	if driverQuery != "" && routeQuery != "" {
		if !CanModifyDispatchShifts(req.UserRole, req.PagePermissions) {
			denialMsg := BuildDispatchModificationDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		shiftType := "ALL"
		if strings.Contains(strings.ToUpper(msg), "AM") {
			shiftType = "AM"
		} else if strings.Contains(strings.ToUpper(msg), "PM") {
			shiftType = "PM"
		}

		action, summaryMsg, err := s.toolService.PrepareDriverAssignment(ctx, date, routeQuery, driverQuery, shiftType, req.OperatorName, req.UserRole, req.PagePermissions, lang)
		if err != nil {
			errPrefix := "⚠️ Could not generate assignment:"
			if isFr {
				errPrefix = "⚠️ Impossible de générer l'affectation :"
			}
			return &models.AIChatResponse{
				Reply: fmt.Sprintf("%s %s", errPrefix, err.Error()),
			}, nil
		}

		cardTitle := "Pending Assignment Confirmation"
		suggested := []string{"Confirm", "Cancel"}
		if isFr {
			cardTitle = "Affectation en attente de confirmation"
			suggested = []string{"Confirmer", "Annuler"}
		}

		return &models.AIChatResponse{
			Reply: summaryMsg,
			ActionCards: []models.AIActionCard{
				{
					Type:        "confirm_action",
					Title:       cardTitle,
					ActionID:    action.ID,
					RequiresAck: true,
					Data: map[string]interface{}{
						"actionId":      action.ID,
						"routeNo":       action.RouteNo,
						"routeName":     action.RouteName,
						"date":          action.Date,
						"shiftType":     action.ShiftType,
						"driverName":    action.DriverName,
						"driverId":      action.DriverID,
						"oldDriverName": action.OldDriverName,
					},
				},
			},
			SuggestedQuestions: suggested,
		}, nil
	}

	// Pattern C: Driver Schedule Query
	schedRegexEn := regexp.MustCompile(`(?i)(?:schedule\s+(?:for|of)|shifts\s+(?:for|of))\s+([a-zA-Z0-9_\-\.\s]+)`)
	schedRegexEn2 := regexp.MustCompile(`(?i)([a-zA-Z0-9_\-\.\s]+?)(?:'s)?\s+(?:schedule|shifts|tasks)`)
	schedRegexFr := regexp.MustCompile(`(?i)(?:horaire|planning|quarts)\s+(?:de|pour)\s+([a-zA-Z0-9_\-\.\s]+)`)
	schedRegexZh := regexp.MustCompile(`(?i)([a-zA-Z0-9_\-\x{4e00}-\x{9fa5}]+?)(?:今天|今日|明天)?(?:有什么|的|哪些)?(?:班次|排班|任务)`)

	var schedDriver string
	if m := schedRegexEn.FindStringSubmatch(msg); len(m) >= 2 {
		schedDriver = strings.TrimSpace(m[1])
	} else if m := schedRegexEn2.FindStringSubmatch(msg); len(m) >= 2 && !strings.EqualFold(m[1], "today") && !strings.EqualFold(m[1], "fleet") {
		schedDriver = strings.TrimSpace(m[1])
	} else if m := schedRegexFr.FindStringSubmatch(msg); len(m) >= 2 {
		schedDriver = strings.TrimSpace(m[1])
	} else if m := schedRegexZh.FindStringSubmatch(msg); len(m) >= 2 && !strings.Contains(m[1], "什么") && !strings.Contains(m[1], "哪个") {
		schedDriver = strings.TrimSpace(m[1])
	}

	if schedDriver != "" {
		scheduleReply, err := s.toolService.GetDriverSchedule(ctx, schedDriver, date, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
			}
			return &models.AIChatResponse{
				Reply:              scheduleReply,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern D0: Vehicle Fleet Summary
	isVehicleSummaryQuery := strings.Contains(lowerMsg, "fleet status") ||
		strings.Contains(lowerMsg, "vehicle fleet status") ||
		strings.Contains(lowerMsg, "fleet inventory") ||
		strings.Contains(lowerMsg, "vehicle fleet") ||
		strings.Contains(lowerMsg, "vehicle summary") ||
		strings.Contains(lowerMsg, "vehicles summary") ||
		strings.Contains(lowerMsg, "all vehicles") ||
		strings.Contains(lowerMsg, "all buses") ||
		strings.Contains(lowerMsg, "how many buses") ||
		strings.Contains(lowerMsg, "how many vehicles") ||
		strings.Contains(lowerMsg, "flotte de véhicules") ||
		strings.Contains(lowerMsg, "flotte de vehicules") ||
		strings.Contains(lowerMsg, "état de la flotte") ||
		strings.Contains(lowerMsg, "etat de la flotte") ||
		strings.Contains(msg, "车辆总览") ||
		strings.Contains(msg, "车队车辆") ||
		strings.Contains(msg, "车队状态") ||
		strings.Contains(msg, "车辆状态") ||
		strings.Contains(msg, "车辆概况") ||
		strings.Contains(msg, "车队概况") ||
		strings.Contains(msg, "多少辆车") ||
		strings.Contains(msg, "车辆统计")

	if isVehicleSummaryQuery || strings.EqualFold(lowerMsg, "vehicles") || strings.EqualFold(lowerMsg, "fleet") {
		vehReply, card, err := s.toolService.GetVehicleSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
			} else if isZh {
				suggested = []string{"今天有哪些路线缺司机？", "今日校车调度总览"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              vehReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern D1: Specific Vehicle Query / Details
	isVehicleDetailsQuery := (strings.Contains(lowerMsg, "vehicle info") ||
		strings.Contains(lowerMsg, "bus info") ||
		strings.Contains(lowerMsg, "unit info") ||
		strings.Contains(lowerMsg, "about vehicle") ||
		strings.Contains(lowerMsg, "about bus") ||
		strings.Contains(lowerMsg, "find vehicle") ||
		strings.Contains(lowerMsg, "find bus") ||
		strings.Contains(lowerMsg, "info véhicule") ||
		strings.Contains(lowerMsg, "détails véhicule") ||
		strings.Contains(msg, "车辆信息") ||
		strings.Contains(msg, "查询车辆") ||
		strings.Contains(msg, "车号") ||
		strings.Contains(msg, "查车") ||
		regexp.MustCompile(`(?i)(?:vehicle|bus|unit|véhicule|vehicule)\s+[0-9a-zA-Z_\-]+`).MatchString(msg) ||
		regexp.MustCompile(`[0-9]{3,5}号车`).MatchString(msg)) &&
		!strings.Contains(lowerMsg, "fleet") &&
		!strings.Contains(lowerMsg, "summary") &&
		!strings.Contains(lowerMsg, "overview") &&
		!strings.Contains(lowerMsg, "all") &&
		!strings.Contains(lowerMsg, "flotte") &&
		!strings.Contains(msg, "车队") &&
		!strings.Contains(msg, "总览") &&
		!strings.Contains(msg, "概况") &&
		!strings.Contains(msg, "统计") &&
		!strings.Contains(msg, "所有")

	if isVehicleDetailsQuery {
		vehReply, card, err := s.toolService.GetVehicleDetails(ctx, msg, date, lang)
		if err == nil {
			suggested := []string{"Vehicle fleet status", "Which shifts have no driver today?"}
			if isFr {
				suggested = []string{"Statut de la flotte de véhicules", "Quels quarts n'ont pas de chauffeur aujourd'hui ?"}
			} else if isZh {
				suggested = []string{"查看车队车辆状态", "今天有哪些路线缺司机？"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              vehReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern E0: Route Summary / Route Fleet Query
	isRouteSummaryQuery := strings.Contains(lowerMsg, "route summary") ||
		strings.Contains(lowerMsg, "routes summary") ||
		strings.Contains(lowerMsg, "all routes") ||
		strings.Contains(lowerMsg, "route fleet") ||
		strings.Contains(lowerMsg, "how many routes") ||
		strings.Contains(lowerMsg, "list routes") ||
		strings.Contains(lowerMsg, "toutes les lignes") ||
		strings.Contains(lowerMsg, "synthèse des lignes") ||
		strings.Contains(lowerMsg, "synthese des lignes") ||
		strings.Contains(lowerMsg, "réseau des lignes") ||
		strings.Contains(lowerMsg, "reseau des lignes") ||
		strings.Contains(msg, "线路总览") ||
		strings.Contains(msg, "所有线路") ||
		strings.Contains(msg, "线路汇总") ||
		strings.Contains(msg, "车队线路") ||
		strings.Contains(msg, "多少条线路")

	if isRouteSummaryQuery {
		reply, card, err := s.toolService.GetRouteSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              reply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern E: Route Details Query
	isRouteInfoQuery := strings.Contains(lowerMsg, "route info") ||
		strings.Contains(lowerMsg, "about route") ||
		strings.Contains(lowerMsg, "route details") ||
		strings.Contains(lowerMsg, "find route") ||
		strings.Contains(lowerMsg, "info ligne") ||
		strings.Contains(lowerMsg, "détails ligne") ||
		strings.Contains(lowerMsg, "details ligne") ||
		strings.Contains(lowerMsg, "who is driving route") ||
		strings.Contains(lowerMsg, "who is driving") ||
		strings.Contains(lowerMsg, "who drives route") ||
		strings.Contains(lowerMsg, "who is on route") ||
		strings.Contains(lowerMsg, "who is assigned to route") ||
		strings.Contains(lowerMsg, "qui conduit la ligne") ||
		strings.Contains(lowerMsg, "qui est sur la ligne") ||
		strings.Contains(lowerMsg, "qui est assigné à la ligne") ||
		strings.Contains(msg, "线路详情") ||
		strings.Contains(msg, "路线详情") ||
		strings.Contains(msg, "查询线路") ||
		(strings.Contains(msg, "线路") && (strings.Contains(msg, "谁开") || strings.Contains(msg, "谁负责") || strings.Contains(msg, "司机是谁") || strings.Contains(msg, "分配给谁"))) ||
		(strings.Contains(msg, "谁") && strings.Contains(msg, "开") && (strings.Contains(msg, "线路") || strings.Contains(msg, "路")))

	if isRouteInfoQuery {
		routeReply, card, err := s.toolService.GetRouteDetails(ctx, msg, date, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?", "Vehicle fleet status"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Statut de la flotte de véhicules"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              routeReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern F: Operational Summary
	isSummary := (strings.Contains(lowerMsg, "summary") ||
		strings.Contains(lowerMsg, "overview") ||
		strings.Contains(lowerMsg, "stats") ||
		strings.Contains(lowerMsg, "statistic") ||
		strings.Contains(lowerMsg, "operations") ||
		strings.Contains(lowerMsg, "résumé") ||
		strings.Contains(lowerMsg, "resume") ||
		strings.Contains(lowerMsg, "aperçu") ||
		strings.Contains(lowerMsg, "apercu") ||
		strings.Contains(lowerMsg, "vue d'ensemble") ||
		strings.Contains(lowerMsg, "flotte") ||
		strings.Contains(msg, "概况") ||
		strings.Contains(msg, "统计") ||
		strings.Contains(msg, "调度总览") ||
		strings.Contains(msg, "总览") ||
		strings.Contains(msg, "总体情况") ||
		strings.Contains(msg, "出车情况")) &&
		!strings.Contains(lowerMsg, "time off") &&
		!strings.Contains(lowerMsg, "time-off") &&
		!strings.Contains(lowerMsg, "leave") &&
		!strings.Contains(lowerMsg, "congé") &&
		!strings.Contains(lowerMsg, "conge") &&
		!strings.Contains(msg, "请假") &&
		!strings.Contains(msg, "休假") &&
		!strings.Contains(lowerMsg, "expense") &&
		!strings.Contains(lowerMsg, "frais") &&
		!strings.Contains(msg, "报销") &&
		!strings.Contains(lowerMsg, "student") &&
		!strings.Contains(lowerMsg, "élève") &&
		!strings.Contains(lowerMsg, "eleve") &&
		!strings.Contains(msg, "学生") &&
		!strings.Contains(lowerMsg, "route") &&
		!strings.Contains(lowerMsg, "ligne") &&
		!strings.Contains(msg, "线路") &&
		!strings.Contains(lowerMsg, "employee") &&
		!strings.Contains(lowerMsg, "staff") &&
		!strings.Contains(lowerMsg, "driver") &&
		!strings.Contains(msg, "员工") &&
		!strings.Contains(msg, "司机") &&
		!strings.Contains(lowerMsg, "payroll") &&
		!strings.Contains(lowerMsg, "compensation") &&
		!strings.Contains(lowerMsg, "pay rate") &&
		!strings.Contains(lowerMsg, "paie") &&
		!strings.Contains(lowerMsg, "salaire") &&
		!strings.Contains(msg, "工资") &&
		!strings.Contains(msg, "薪资") &&
		!strings.Contains(msg, "薪酬")

	if isSummary {
		summary, err := s.toolService.GetFleetSummary(ctx, date, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?"}
			} else if isZh {
				suggested = []string{"今天有哪些路线缺司机？"}
			}
			return &models.AIChatResponse{
				Reply:              summary,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern G: Payroll & Compensation Queries
	isPayrollQuery := strings.Contains(lowerMsg, "payroll") ||
		strings.Contains(lowerMsg, "compensation") ||
		strings.Contains(lowerMsg, "pay rate") ||
		strings.Contains(lowerMsg, "rate for ") ||
		strings.Contains(lowerMsg, "hourly rate") ||
		strings.Contains(lowerMsg, "rates for ") ||
		strings.Contains(lowerMsg, "salary") ||
		strings.Contains(lowerMsg, "wage") ||
		strings.Contains(lowerMsg, "paie") ||
		strings.Contains(lowerMsg, "rémunération") ||
		strings.Contains(lowerMsg, "remuneration") ||
		strings.Contains(lowerMsg, "salaire") ||
		strings.Contains(lowerMsg, "taux de paie") ||
		strings.Contains(lowerMsg, "taux horaire") ||
		strings.Contains(lowerMsg, "barème") ||
		strings.Contains(lowerMsg, "bareme") ||
		strings.Contains(msg, "工资") ||
		strings.Contains(msg, "薪资") ||
		strings.Contains(msg, "薪酬") ||
		strings.Contains(msg, "费率")

	if isPayrollQuery {
		if !CanAccessPayroll(req.UserRole, req.PagePermissions) {
			denialMsg := BuildPayrollAccessDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		// G1: Daily Dispatch Shift Payroll liability query ("dispatch payroll", "shift payroll", "today's payroll", "paie du dispatch")
		isDispatchShiftPayroll := strings.Contains(lowerMsg, "dispatch payroll") ||
			strings.Contains(lowerMsg, "shift payroll") ||
			strings.Contains(lowerMsg, "shifts payroll") ||
			strings.Contains(lowerMsg, "today's payroll") ||
			strings.Contains(lowerMsg, "todays payroll") ||
			strings.Contains(lowerMsg, "daily payroll") ||
			strings.Contains(lowerMsg, "crew checkout") ||
			strings.Contains(lowerMsg, "labor liability") ||
			strings.Contains(lowerMsg, "paie du jour") ||
			strings.Contains(lowerMsg, "paie du dispatch") ||
			strings.Contains(msg, "今日工资") ||
			strings.Contains(msg, "班次工资") ||
			strings.Contains(msg, "调度工资") ||
			strings.Contains(msg, "出车工资") ||
			strings.Contains(msg, "薪资结算")

		if isDispatchShiftPayroll {
			payReply, card, err := s.toolService.GetDispatchPayrollSummary(ctx, date, lang)
			if err == nil {
				suggested := []string{"Payroll & compensation rates summary", "View today's dispatch overview"}
				if isFr {
					suggested = []string{"Synthèse des taux de rémunération et de paie", "Voir la vue d'ensemble du dispatch"}
				}
				var cards []models.AIActionCard
				if card != nil {
					cards = append(cards, *card)
				}
				return &models.AIChatResponse{
					Reply:              payReply,
					ActionCards:        cards,
					SuggestedQuestions: suggested,
				}, nil
			}
		}

		// G2: Specific rate search if user specifies a route, school board, or driver (e.g. "rate for route 101", "payroll for OCSB")
		isSpecificRateSearch := strings.Contains(lowerMsg, "for route") ||
			strings.Contains(lowerMsg, "for line") ||
			strings.Contains(lowerMsg, "for ocsb") ||
			strings.Contains(lowerMsg, "for ocdsb") ||
			strings.Contains(lowerMsg, "for cepeo") ||
			strings.Contains(lowerMsg, "for cecco") ||
			strings.Contains(lowerMsg, "for driver") ||
			strings.Contains(lowerMsg, "pour la ligne") ||
			strings.Contains(lowerMsg, "pour le chauffeur") ||
			strings.Contains(msg, "路线工资") ||
			strings.Contains(msg, "线路费率") ||
			strings.Contains(msg, "司机工资")

		if isSpecificRateSearch {
			payReply, card, err := s.toolService.GetPayrollDetails(ctx, msg, lang)
			if err == nil {
				suggested := []string{"Payroll & compensation rates summary", "Today's dispatch payroll"}
				if isFr {
					suggested = []string{"Synthèse des taux de rémunération", "Paie du dispatch aujourd'hui"}
				}
				var cards []models.AIActionCard
				if card != nil {
					cards = append(cards, *card)
				}
				return &models.AIChatResponse{
					Reply:              payReply,
					ActionCards:        cards,
					SuggestedQuestions: suggested,
				}, nil
			}
		}

		// G3: Overall Payroll Rates Summary
		payrollReply, card, err := s.toolService.GetPayrollSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Dispatch shift payroll summary", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Paie du dispatch pour aujourd'hui", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              payrollReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern H0: HR & Staff Directory Summary
	isHRQuery := strings.Contains(lowerMsg, "hr ") ||
		strings.Contains(lowerMsg, "human resource") ||
		strings.Contains(lowerMsg, "staff directory") ||
		strings.Contains(lowerMsg, "employee summary") ||
		strings.Contains(lowerMsg, "employees summary") ||
		strings.Contains(lowerMsg, "staff summary") ||
		strings.Contains(lowerMsg, "all staff") ||
		strings.Contains(lowerMsg, "all employees") ||
		strings.Contains(lowerMsg, "all drivers") ||
		strings.Contains(lowerMsg, "active employees") ||
		strings.Contains(lowerMsg, "active staff") ||
		strings.Contains(lowerMsg, "how many drivers") ||
		strings.Contains(lowerMsg, "how many staff") ||
		strings.Contains(lowerMsg, "how many employees") ||
		strings.Contains(lowerMsg, "license compliance") ||
		strings.Contains(lowerMsg, "license expiring") ||
		strings.Contains(lowerMsg, "personnel") ||
		strings.Contains(lowerMsg, "ressources humaines") ||
		strings.Contains(lowerMsg, "conformité des permis") ||
		strings.Contains(lowerMsg, "employés actifs") ||
		strings.Contains(msg, "人事") ||
		strings.Contains(msg, "员工总览") ||
		strings.Contains(msg, "司机总数") ||
		strings.Contains(msg, "人员概况") ||
		strings.Contains(msg, "多少个司机") ||
		strings.Contains(msg, "驾照合规")

	if isHRQuery {
		if !CanAccessHR(req.UserRole, req.PagePermissions) {
			denialMsg := BuildHRAccessDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		hrReply, card, err := s.toolService.GetHRSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Vehicle fleet status", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Statut de la flotte de véhicules", "Voir la vue d'ensemble du dispatch"}
			} else if isZh {
				suggested = []string{"查看车队车辆状态", "今日校车调度总览"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              hrReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern H1: Employee & Staff Queries / Details
	isEmployeeDetailsQuery := (strings.Contains(lowerMsg, "driver info") ||
		strings.Contains(lowerMsg, "employee info") ||
		strings.Contains(lowerMsg, "about driver") ||
		strings.Contains(lowerMsg, "about employee") ||
		strings.Contains(lowerMsg, "info chauffeur") ||
		strings.Contains(lowerMsg, "détails chauffeur") ||
		strings.Contains(msg, "司机信息") ||
		strings.Contains(msg, "员工信息") ||
		strings.Contains(msg, "查询司机") ||
		strings.Contains(msg, "查询员工") ||
		strings.Contains(msg, "查司机") ||
		strings.Contains(msg, "查员工") ||
		regexp.MustCompile(`(?i)(?:driver|employee|chauffeur|employé|employe)\s+[a-zA-Z0-9_\-\.\x{4e00}-\x{9fa5}]+`).MatchString(msg) ||
		(strings.HasPrefix(lowerMsg, "contact for ") || strings.HasPrefix(lowerMsg, "phone for "))) &&
		!strings.Contains(lowerMsg, "summary") &&
		!strings.Contains(lowerMsg, "overview") &&
		!strings.Contains(lowerMsg, "directory") &&
		!strings.Contains(lowerMsg, "all") &&
		!strings.Contains(msg, "总览") &&
		!strings.Contains(msg, "概况") &&
		!strings.Contains(msg, "统计") &&
		!strings.Contains(msg, "全部")

	if isEmployeeDetailsQuery {
		empReply, card, err := s.toolService.GetEmployeeDetails(ctx, msg, date, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
			} else if isZh {
				suggested = []string{"今天有哪些路线缺司机？", "今日校车调度总览"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              empReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern I: Student Queries
	isStudentSummaryQuery := strings.Contains(lowerMsg, "student summary") ||
		strings.Contains(lowerMsg, "students summary") ||
		strings.Contains(lowerMsg, "how many students") ||
		strings.Contains(lowerMsg, "student count") ||
		strings.Contains(lowerMsg, "students count") ||
		strings.Contains(lowerMsg, "students overview") ||
		strings.Contains(lowerMsg, "nombre d'élèves") ||
		strings.Contains(lowerMsg, "nombre d'eleves") ||
		strings.Contains(msg, "学生总数") ||
		strings.Contains(msg, "学生概况") ||
		strings.Contains(msg, "学生汇总") ||
		strings.Contains(msg, "有多少学生")

	if isStudentSummaryQuery {
		stuReply, card, err := s.toolService.GetStudentSummary(ctx, lang)
		if err == nil {
			suggested := []string{"View today's dispatch overview", "Which shifts have no driver today?"}
			if isFr {
				suggested = []string{"Voir la vue d'ensemble du dispatch", "Quels quarts n'ont pas de chauffeur aujourd'hui ?"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              stuReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	isStudentInfoQuery := (strings.Contains(lowerMsg, "student info") ||
		strings.Contains(lowerMsg, "about student") ||
		strings.Contains(lowerMsg, "find student") ||
		strings.Contains(lowerMsg, "student details") ||
		strings.Contains(lowerMsg, "which route is student") ||
		strings.Contains(lowerMsg, "info élève") ||
		strings.Contains(lowerMsg, "détails élève") ||
		strings.Contains(msg, "学生信息") ||
		strings.Contains(msg, "查询学生") ||
		strings.Contains(msg, "查学生") ||
		regexp.MustCompile(`(?i)(?:student|élève|eleve|étudiant|etudiant)\s+[a-zA-Z0-9_\-\.\x{4e00}-\x{9fa5}]+`).MatchString(msg) ||
		(strings.Contains(msg, "学生") && (strings.Contains(msg, "谁") || strings.Contains(msg, "哪条") || strings.Contains(msg, "路线") || strings.Contains(msg, "线路")))) &&
		!strings.Contains(lowerMsg, "incident") &&
		!strings.Contains(lowerMsg, "safety") &&
		!strings.Contains(lowerMsg, "hazard") &&
		!strings.Contains(lowerMsg, "behavior") &&
		!strings.Contains(lowerMsg, "discipline") &&
		!strings.Contains(lowerMsg, "comportement") &&
		!strings.Contains(msg, "事件") &&
		!strings.Contains(msg, "事故") &&
		!strings.Contains(msg, "安全") &&
		!strings.Contains(msg, "隐患") &&
		!strings.Contains(msg, "处分") &&
		!strings.Contains(msg, "违规")

	if isStudentInfoQuery {
		stuReply, card, err := s.toolService.GetStudentDetails(ctx, msg, lang)
		if err == nil {
			suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              stuReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern J0: Time Off Requests Summary
	isTimeOffSummaryQuery := strings.Contains(lowerMsg, "time off summary") ||
		strings.Contains(lowerMsg, "time off overview") ||
		strings.Contains(lowerMsg, "leave summary") ||
		strings.Contains(lowerMsg, "leave overview") ||
		strings.Contains(lowerMsg, "vacation summary") ||
		strings.Contains(lowerMsg, "how many on leave") ||
		strings.Contains(lowerMsg, "how many time off") ||
		strings.Contains(lowerMsg, "synthèse des congés") ||
		strings.Contains(lowerMsg, "synthese des conges") ||
		strings.Contains(lowerMsg, "aperçu des congés") ||
		strings.Contains(lowerMsg, "demandes de congé") ||
		strings.Contains(lowerMsg, "demandes de conge") ||
		strings.Contains(msg, "请假申请汇总") ||
		strings.Contains(msg, "请假申请") ||
		strings.Contains(msg, "请假汇总") ||
		strings.Contains(msg, "请假总览") ||
		strings.Contains(msg, "请假概况") ||
		strings.Contains(msg, "请假统计") ||
		strings.Contains(msg, "休假总览") ||
		strings.Contains(msg, "休假概况") ||
		strings.Contains(msg, "多少人请假") ||
		strings.Contains(msg, "多少人休假")

	if isTimeOffSummaryQuery {
		if !CanAccessTimeOff(req.UserRole, req.PagePermissions) {
			denialMsg := BuildTimeOffAccessDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		toReply, card, err := s.toolService.GetTimeOffSummary(ctx, date, lang)
		if err == nil {
			suggested := []string{"Who is off today?", "Pending time off requests"}
			if isFr {
				suggested = []string{"Qui est en congé aujourd'hui ?", "Voir les congés en attente"}
			} else if isZh {
				suggested = []string{"今天谁请假？", "待审批请假"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              toReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern J1: Time Off Details / Pending / Specific query
	isTimeOffDetailsQuery := strings.Contains(lowerMsg, "time off") ||
		strings.Contains(lowerMsg, "time-off") ||
		strings.Contains(lowerMsg, "pending leave") ||
		strings.Contains(lowerMsg, "leave request") ||
		strings.Contains(lowerMsg, "leave requests") ||
		strings.Contains(lowerMsg, "who is off") ||
		strings.Contains(lowerMsg, "who is on leave") ||
		strings.Contains(lowerMsg, "sick leave") ||
		strings.Contains(lowerMsg, "vacation request") ||
		strings.Contains(lowerMsg, "qui est en congé") ||
		strings.Contains(lowerMsg, "qui est en conge") ||
		strings.Contains(lowerMsg, "congé en attente") ||
		strings.Contains(lowerMsg, "conge en attente") ||
		strings.Contains(lowerMsg, "demande de congé") ||
		strings.Contains(lowerMsg, "demande de conge") ||
		strings.Contains(msg, "请假") ||
		strings.Contains(msg, "休假") ||
		strings.Contains(msg, "谁请假") ||
		strings.Contains(msg, "谁在休假") ||
		strings.Contains(msg, "今天谁不上班") ||
		strings.Contains(msg, "待审批请假") ||
		strings.Contains(msg, "查请假")

	if isTimeOffDetailsQuery {
		if !CanAccessTimeOff(req.UserRole, req.PagePermissions) {
			denialMsg := BuildTimeOffAccessDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		toReply, card, err := s.toolService.GetTimeOffDetails(ctx, msg, date, lang)
		if err == nil {
			suggested := []string{"Time off summary", "Which shifts have no driver today?"}
			if isFr {
				suggested = []string{"Synthèse des demandes de congé", "Quels quarts n'ont pas de chauffeur aujourd'hui ?"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              toReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern K0: Expense Reimbursement Summary
	isExpenseSummaryQuery := strings.Contains(lowerMsg, "expense summary") ||
		strings.Contains(lowerMsg, "expenses summary") ||
		strings.Contains(lowerMsg, "reimbursement summary") ||
		strings.Contains(lowerMsg, "reimbursements summary") ||
		strings.Contains(lowerMsg, "claims summary") ||
		strings.Contains(lowerMsg, "all expenses") ||
		strings.Contains(lowerMsg, "all expense claims") ||
		strings.Contains(lowerMsg, "notes de frais") ||
		strings.Contains(lowerMsg, "synthèse des notes de frais") ||
		strings.Contains(lowerMsg, "synthese des notes de frais") ||
		strings.Contains(lowerMsg, "remboursements de frais") ||
		strings.Contains(msg, "报销申请汇总") ||
		strings.Contains(msg, "报销申请") ||
		strings.Contains(msg, "报销汇总") ||
		strings.Contains(msg, "报销总览") ||
		strings.Contains(msg, "报销概况") ||
		strings.Contains(msg, "费用报销总览") ||
		strings.Contains(msg, "所有报销") ||
		strings.Contains(msg, "报销统计")

	if isExpenseSummaryQuery {
		if !CanAccessExpenses(req.UserRole, req.PagePermissions) {
			denialMsg := BuildExpenseAccessDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		expReply, card, err := s.toolService.GetExpenseSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Pending expense claims", "Payroll & compensation rates summary"}
			if isFr {
				suggested = []string{"Voir les remboursements en attente", "Synthèse des taux de rémunération et de paie"}
			} else if isZh {
				suggested = []string{"查看待审批报销", "薪酬与费率汇总"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              expReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern K1: Expense Reimbursement Details / Pending / Specific query
	isExpenseDetailsQuery := strings.Contains(lowerMsg, "expense") ||
		strings.Contains(lowerMsg, "expenses") ||
		strings.Contains(lowerMsg, "reimbursement") ||
		strings.Contains(lowerMsg, "reimbursements") ||
		strings.Contains(lowerMsg, "expense claim") ||
		strings.Contains(lowerMsg, "expense claims") ||
		strings.Contains(lowerMsg, "pending expense") ||
		strings.Contains(lowerMsg, "pending claims") ||
		strings.Contains(lowerMsg, "note de frais") ||
		strings.Contains(lowerMsg, "remboursement") ||
		strings.Contains(lowerMsg, "frais en attente") ||
		strings.Contains(msg, "报销") ||
		strings.Contains(msg, "费用申请") ||
		strings.Contains(msg, "待报销") ||
		strings.Contains(msg, "查报销")

	if isExpenseDetailsQuery {
		if !CanAccessExpenses(req.UserRole, req.PagePermissions) {
			denialMsg := BuildExpenseAccessDeniedMessage(req.UserRole, lang)
			return &models.AIChatResponse{
				Reply: denialMsg,
			}, nil
		}

		expReply, card, err := s.toolService.GetExpenseDetails(ctx, msg, lang)
		if err == nil {
			suggested := []string{"Expense reimbursement summary", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Synthèse des notes de frais", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              expReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern L1: Training Courses Summary / Query
	isTrainingSummaryQuery := strings.Contains(lowerMsg, "training summary") ||
		strings.Contains(lowerMsg, "training courses") ||
		strings.Contains(lowerMsg, "trainings") ||
		strings.Contains(lowerMsg, "training sessions") ||
		strings.Contains(lowerMsg, "all training") ||
		strings.Contains(lowerMsg, "upcoming training") ||
		strings.Contains(lowerMsg, "formation") ||
		strings.Contains(lowerMsg, "formations") ||
		strings.Contains(lowerMsg, "session de formation") ||
		strings.Contains(lowerMsg, "cours de formation") ||
		strings.Contains(msg, "培训总结") ||
		strings.Contains(msg, "培训汇总") ||
		strings.Contains(msg, "所有培训") ||
		strings.Contains(msg, "近期培训") ||
		strings.Contains(msg, "培训课程") ||
		(strings.Contains(lowerMsg, "training") && (strings.Contains(lowerMsg, "summary") || strings.Contains(lowerMsg, "overview") || strings.Contains(lowerMsg, "all") || strings.Contains(lowerMsg, "list") || strings.Contains(lowerMsg, "upcoming")))

	if isTrainingSummaryQuery {
		trReply, card, err := s.toolService.GetTrainingSummary(ctx, date, lang)
		if err == nil {
			suggested := []string{"First Aid training details", "Defensive Driving course", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Détails de la formation Premiers Soins", "Formation Conduite Défensive", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              trReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern L2: Training Course Details / Specific Query
	isTrainingDetailsQuery := strings.Contains(lowerMsg, "training") ||
		strings.Contains(lowerMsg, "formation") ||
		strings.Contains(lowerMsg, "course") ||
		strings.Contains(lowerMsg, "cours") ||
		strings.Contains(lowerMsg, "attendee") ||
		strings.Contains(lowerMsg, "curriculum") ||
		strings.Contains(msg, "培训") ||
		strings.Contains(msg, "课程")

	if isTrainingDetailsQuery {
		trReply, card, err := s.toolService.GetTrainingDetails(ctx, msg, lang)
		if err == nil {
			suggested := []string{"Training courses summary", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Synthèse des formations", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              trReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern M1: Student Incident Summary
	isStudentIncidentSummaryQuery := strings.Contains(lowerMsg, "student incident summary") ||
		strings.Contains(lowerMsg, "incident summary") ||
		strings.Contains(lowerMsg, "all student incidents") ||
		strings.Contains(lowerMsg, "all incidents") ||
		strings.Contains(lowerMsg, "recent student safety incidents") ||
		strings.Contains(lowerMsg, "recent safety incidents") ||
		strings.Contains(lowerMsg, "recent student incidents") ||
		strings.Contains(lowerMsg, "recent incidents") ||
		strings.Contains(lowerMsg, "student safety incidents") ||
		strings.Contains(lowerMsg, "student safety incident") ||
		strings.Contains(lowerMsg, "student safety") ||
		strings.Contains(lowerMsg, "safety incidents") ||
		strings.Contains(lowerMsg, "safety incident") ||
		strings.Contains(lowerMsg, "student incidents") ||
		strings.Contains(lowerMsg, "student incident") ||
		strings.Contains(lowerMsg, "student behavior") ||
		strings.Contains(lowerMsg, "student issues") ||
		strings.Contains(lowerMsg, "incidents élèves") ||
		strings.Contains(lowerMsg, "incidents eleves") ||
		strings.Contains(lowerMsg, "résumé des incidents") ||
		strings.Contains(lowerMsg, "incidents récents") ||
		strings.Contains(lowerMsg, "incidents recents") ||
		strings.Contains(msg, "学生事件总结") ||
		strings.Contains(msg, "学生事故汇总") ||
		strings.Contains(msg, "所有学生事件") ||
		strings.Contains(msg, "学生违规汇总") ||
		strings.Contains(msg, "学生安全事件") ||
		strings.Contains(msg, "最近学生安全事件") ||
		strings.Contains(msg, "最近学生事件") ||
		strings.Contains(msg, "学生事件") ||
		strings.Contains(msg, "学生事故") ||
		strings.Contains(msg, "安全事件") ||
		(strings.Contains(lowerMsg, "incident") && (strings.Contains(lowerMsg, "summary") || strings.Contains(lowerMsg, "all") || strings.Contains(lowerMsg, "list") || strings.Contains(lowerMsg, "open") || strings.Contains(lowerMsg, "recent")))

	if isStudentIncidentSummaryQuery {
		incReply, card, err := s.toolService.GetStudentIncidentSummary(ctx, date, lang)
		if err == nil {
			suggested := []string{"Recent student incidents", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Incidents récents d'élèves", "Voir la vue d'ensemble du dispatch"}
			} else if isZh {
				suggested = []string{"今日校车调度总览", "查看车队车辆状态"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              incReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern M2: Student Incident Details / Specific Query
	isStudentIncidentDetailsQuery := strings.Contains(lowerMsg, "student incident") ||
		strings.Contains(lowerMsg, "incident report") ||
		strings.Contains(lowerMsg, "incident") ||
		strings.Contains(lowerMsg, "incidents") ||
		strings.Contains(lowerMsg, "discipline") ||
		strings.Contains(lowerMsg, "rapport d'incident") ||
		strings.Contains(lowerMsg, "comportement") ||
		strings.Contains(lowerMsg, "student safety") ||
		strings.Contains(lowerMsg, "safety incident") ||
		strings.Contains(msg, "学生事件") ||
		strings.Contains(msg, "事故报告") ||
		strings.Contains(msg, "违规报告") ||
		strings.Contains(msg, "学生处分") ||
		strings.Contains(msg, "学生安全")

	if isStudentIncidentDetailsQuery {
		incReply, card, err := s.toolService.GetStudentIncidentDetails(ctx, msg, lang)
		if err == nil {
			suggested := []string{"Student incident summary", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Synthèse des incidents élèves", "Voir la vue d'ensemble du dispatch"}
			} else if isZh {
				suggested = []string{"今日校车调度总览", "查看车队车辆状态"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              incReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern N1: Hazard & Near-Miss Summary
	isHazardSummaryQuery := strings.Contains(lowerMsg, "hazard summary") ||
		strings.Contains(lowerMsg, "hazards") ||
		strings.Contains(lowerMsg, "hazard report") ||
		strings.Contains(lowerMsg, "hazard reports") ||
		strings.Contains(lowerMsg, "safety concerns") ||
		strings.Contains(lowerMsg, "near miss") ||
		strings.Contains(lowerMsg, "near misses") ||
		strings.Contains(lowerMsg, "close calls") ||
		strings.Contains(lowerMsg, "rapports de danger") ||
		strings.Contains(lowerMsg, "dangers") ||
		strings.Contains(lowerMsg, "quasi-accident") ||
		strings.Contains(msg, "安全隐患汇总") ||
		strings.Contains(msg, "危险报告") ||
		strings.Contains(msg, "隐患汇总") ||
		strings.Contains(msg, "近失事件") ||
		(strings.Contains(lowerMsg, "hazard") && (strings.Contains(lowerMsg, "summary") || strings.Contains(lowerMsg, "all") || strings.Contains(lowerMsg, "open") || strings.Contains(lowerMsg, "list")))

	if isHazardSummaryQuery {
		hzReply, card, err := s.toolService.GetHazardReportSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Open serious hazards", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Dangers graves ouverts", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              hzReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern N2: Hazard Report Details / Specific Query
	isHazardDetailsQuery := strings.Contains(lowerMsg, "hazard") ||
		strings.Contains(lowerMsg, "danger") ||
		strings.Contains(lowerMsg, "risk") ||
		strings.Contains(lowerMsg, "near miss") ||
		strings.Contains(lowerMsg, "close call") ||
		strings.Contains(lowerMsg, "quasi-accident") ||
		strings.Contains(lowerMsg, "sécurité") ||
		strings.Contains(lowerMsg, "securite") ||
		strings.Contains(msg, "隐患") ||
		strings.Contains(msg, "危险")

	if isHazardDetailsQuery {
		hzReply, card, err := s.toolService.GetHazardReportDetails(ctx, msg, lang)
		if err == nil {
			suggested := []string{"Hazard report summary", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Synthèse des dangers", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              hzReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern O1: Route Assessment Summary
	isAssessmentSummaryQuery := strings.Contains(lowerMsg, "route assessment summary") ||
		strings.Contains(lowerMsg, "route assessments") ||
		strings.Contains(lowerMsg, "route audits") ||
		strings.Contains(lowerMsg, "all assessments") ||
		strings.Contains(lowerMsg, "safety audits") ||
		strings.Contains(lowerMsg, "évaluations de ligne") ||
		strings.Contains(lowerMsg, "evaluations de ligne") ||
		strings.Contains(lowerMsg, "audits de ligne") ||
		strings.Contains(msg, "线路评估汇总") ||
		strings.Contains(msg, "路线评估汇总") ||
		strings.Contains(msg, "安全评估汇总") ||
		(strings.Contains(lowerMsg, "assessment") && (strings.Contains(lowerMsg, "summary") || strings.Contains(lowerMsg, "all") || strings.Contains(lowerMsg, "list") || strings.Contains(lowerMsg, "routes")))

	if isAssessmentSummaryQuery {
		raReply, card, err := s.toolService.GetRouteAssessmentSummary(ctx, lang)
		if err == nil {
			suggested := []string{"Route assessment for OCSB-050", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Évaluation de la ligne OCSB-050", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              raReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Pattern O2: Route Assessment Details / Specific Route Query
	isAssessmentDetailsQuery := strings.Contains(lowerMsg, "route assessment") ||
		strings.Contains(lowerMsg, "line assessment") ||
		strings.Contains(lowerMsg, "route audit") ||
		strings.Contains(lowerMsg, "assessment") ||
		strings.Contains(lowerMsg, "évaluation de ligne") ||
		strings.Contains(lowerMsg, "evaluation de ligne") ||
		strings.Contains(lowerMsg, "audit de sécurité") ||
		strings.Contains(msg, "线路评估") ||
		strings.Contains(msg, "路线评估") ||
		strings.Contains(msg, "路考评估")

	if isAssessmentDetailsQuery {
		raReply, card, err := s.toolService.GetRouteAssessmentDetails(ctx, msg, lang)
		if err == nil {
			suggested := []string{"Route assessments summary", "View today's dispatch overview"}
			if isFr {
				suggested = []string{"Synthèse des évaluations de ligne", "Voir la vue d'ensemble du dispatch"}
			}
			var cards []models.AIActionCard
			if card != nil {
				cards = append(cards, *card)
			}
			return &models.AIChatResponse{
				Reply:              raReply,
				ActionCards:        cards,
				SuggestedQuestions: suggested,
			}, nil
		}
	}

	// Fallback general guidance tailored to the user's role (Zero Chinese)
	roleNorm := NormalizeRole(req.UserRole)
	if isFr {
		var reply string
		var suggested []string

		switch roleNorm {
		case "HR":
			reply = "Je suis votre Copilote IA. En tant que **RH**, voici vos actions recommandées :\n" +
				"- 👥 **“Résumé des employés et conformité RH”**\n" +
				"- 📋 **“Vérifier la conformité des permis de conduire”**\n" +
				"- 🚐 **“Statut de la flotte de véhicules”**\n" +
				"- 📊 **“Aperçu de la régulation”**\n\n" +
				"*(Note : La modification des quarts de régulation est réservée aux régulateurs)*"
			suggested = []string{
				"Résumé des employés et conformité RH",
				"Statut de la flotte de véhicules",
				"Aperçu de la régulation",
			}
		case "payroll":
			reply = "Je suis votre Copilote IA. En tant que responsable **Paie**, voici vos actions recommandées :\n" +
				"- 💰 **“Synthèse des taux de rémunération et de paie”**\n" +
				"- 📊 **“Aperçu de la régulation”**\n" +
				"- 🚌 **“Informations sur la ligne OCSB-050”**\n\n" +
				"*(Note : La modification des quarts de régulation est réservée aux régulateurs)*"
			suggested = []string{
				"Synthèse des taux de rémunération et de paie",
				"Aperçu de la régulation",
				"Statut de la flotte de véhicules",
			}
		default:
			reply = "Je suis votre Copilote IA d'opérations. Vous pouvez me poser des questions sur toutes les pages :\n" +
				"- 🔍 **“Quels quarts n'ont pas de chauffeur aujourd'hui ?”**\n" +
				"- ⚡ **“Assigner Tom sur la ligne csdf-001”**\n" +
				"- 📅 **“Planning de Tom”**\n" +
				"- 🚐 **“Statut de la flotte de véhicules”**\n" +
				"- 🚌 **“Informations sur la ligne OCSB-050”**\n" +
				"- 📊 **“Aperçu de la régulation”**"
			suggested = []string{
				"Quels quarts n'ont pas de chauffeur aujourd'hui ?",
				"Statut de la flotte de véhicules",
				"Aperçu de la régulation",
			}
		}

		return &models.AIChatResponse{
			Reply:              reply,
			SuggestedQuestions: suggested,
			Engine:             "builtin_fallback",
		}, nil
	}

	if isZh {
		var reply string
		var suggested []string

		switch roleNorm {
		case "HR":
			reply = "我是您的校车运营 AI 助手。作为 **人事 (HR)**，您可以查询员工档案、跟进驾驶证与合规资质、查看车队车辆状态等。*(注：班次修改权限仅限调度员)*"
			suggested = []string{
				"员工档案与资质合规概览",
				"查看车队车辆状态",
				"今日校车调度总览",
			}
		case "payroll":
			reply = "我是您的校车运营 AI 助手。作为 **薪酬/财务 (Payroll)**，您可以查询薪酬费率、路线计费标准与排班工时统计。*(注：班次修改权限仅限调度员)*"
			suggested = []string{
				"薪资与排班工时汇总",
				"今日校车调度总览",
				"查看车队车辆状态",
			}
		default:
			reply = "我是您的校车运营调度 AI 助手。您可以向我咨询调度与运营相关事务：\n" +
				"- 🔍 **“今天有哪些班次缺少司机？”**\n" +
				"- ⚡ **“帮我查询路线信息”**\n" +
				"- 📅 **“查询司机的排班日历”**\n" +
				"- 🚐 **“查看车队车辆状态”**\n" +
				"- 📊 **“今日校车调度总览”**"
			suggested = []string{
				"今天有哪些班次缺少司机？",
				"查看车队车辆状态",
				"今日校车调度总览",
			}
		}

		return &models.AIChatResponse{
			Reply:              reply,
			SuggestedQuestions: suggested,
			Engine:             "builtin_fallback",
		}, nil
	}

	// English fallback
	var replyEn string
	var suggestedEn []string

	switch roleNorm {
	case "HR":
		replyEn = "I am your AI Copilot. In your **HR** role, here are recommended inquiries:\n" +
			"- 👥 **“HR staff summary & active employees”**\n" +
			"- 📋 **“Check driver license compliance”**\n" +
			"- 🚐 **“Vehicle fleet status”**\n" +
			"- 📊 **“View today's dispatch overview”**\n\n" +
			"*(Note: Modifying dispatch shifts is restricted to Dispatchers)*"
		suggestedEn = []string{
			"HR staff summary & active employees",
			"Vehicle fleet status",
			"View today's dispatch overview",
		}
	case "payroll":
		replyEn = "I am your AI Copilot. In your **Payroll** role, here are recommended inquiries:\n" +
			"- 💰 **“Payroll & compensation rates summary”**\n" +
			"- 📊 **“View today's dispatch overview”**\n" +
			"- 🚌 **“Route info for OCSB-050”**\n\n" +
			"*(Note: Modifying dispatch shifts is restricted to Dispatchers)*"
		suggestedEn = []string{
			"Payroll & compensation rates summary",
			"View today's dispatch overview",
			"Vehicle fleet status",
		}
	default:
		replyEn = "I am your AI Operations Copilot. You can ask me across all pages:\n" +
			"- 🔍 **“Which shifts have no driver today?”**\n" +
			"- ⚡ **“Assign Tom to route csdf-001”**\n" +
			"- 📅 **“Tom's schedule”**\n" +
			"- 🚐 **“Vehicle fleet status”**\n" +
			"- 🚌 **“Route info for OCSB-050”**\n" +
			"- 📊 **“View today's dispatch overview”**"
		suggestedEn = []string{
			"Which shifts have no driver today?",
			"Vehicle fleet status",
			"View today's dispatch overview",
		}
	}

	return &models.AIChatResponse{
		Reply:              replyEn,
		SuggestedQuestions: suggestedEn,
		Engine:             "builtin_fallback",
	}, nil
}

// processWithGemini handles LLM invocation with tool schemas
func (s *AIService) processWithGemini(ctx context.Context, req *models.AIChatRequest, apiKey string, lang string) (*models.AIChatResponse, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", apiKey)
	isFr := lang == "fr"
	isZh := lang == "zh"

	normRole := NormalizeRole(req.UserRole)
	canModifyDispatch := CanModifyDispatchShifts(req.UserRole, req.PagePermissions)
	canAccessPayroll := CanAccessPayroll(req.UserRole, req.PagePermissions)
	canAccessHR := CanAccessHR(req.UserRole, req.PagePermissions)

	var systemPrompt string
	if isZh {
		systemPrompt = fmt.Sprintf(
			"You are the AI Dispatch Copilot for School Bus Fleet Management. Today's date is %s. "+
				"The authenticated user has role '%s'. Permissions: can_modify_dispatch=%t, can_access_payroll=%t, can_access_hr=%t. "+
				"You can answer questions about bus routes, drivers, shifts, fleet vehicles, students, staff, payroll, time off requests, expense claims, driver training courses, student incidents, hazard safety reports, and route safety assessments. "+
				"If can_modify_dispatch is false and user asks to assign a driver or modify shifts, DO NOT call assignment tool; politely refuse in Chinese explaining that only Dispatchers and Admins can modify shifts. "+
				"If can_access_payroll is false and user asks about payroll or compensation, politely refuse in Chinese stating insufficient permissions. "+
				"ALWAYS answer politely, clearly, and fluently in Chinese (中文). When assigning drivers, important actions MUST be confirmed before actual execution.",
			req.Date, normRole, canModifyDispatch, canAccessPayroll, canAccessHR,
		)
	} else if isFr {
		systemPrompt = fmt.Sprintf(
			"You are the AI Dispatch Copilot for School Bus Fleet Management. Today's date is %s. "+
				"The authenticated user has role '%s'. Permissions: can_modify_dispatch=%t, can_access_payroll=%t, can_access_hr=%t. "+
				"You can answer questions about bus routes, drivers, shifts, fleet vehicles, students, staff, payroll, time off requests, expense claims, driver training courses, student incidents, hazard safety reports, and route safety assessments. "+
				"If can_modify_dispatch is false and user asks to assign a driver or modify shifts, DO NOT call assignment tool; politely refuse in French explaining that only Dispatchers and Admins can modify shifts. "+
				"If can_access_payroll is false and user asks about payroll or compensation, politely refuse in French stating insufficient permissions. "+
				"ALWAYS answer in French (Français). When assigning drivers, important actions MUST be confirmed before actual execution.",
			req.Date, normRole, canModifyDispatch, canAccessPayroll, canAccessHR,
		)
	} else {
		systemPrompt = fmt.Sprintf(
			"You are the AI Dispatch Copilot for School Bus Fleet Management. Today's date is %s. "+
				"The authenticated user has role '%s'. Permissions: can_modify_dispatch=%t, can_access_payroll=%t, can_access_hr=%t. "+
				"You can answer questions about bus routes, drivers, shifts, fleet vehicles, students, staff, payroll, time off requests, expense claims, driver training courses, student incidents, hazard safety reports, and route safety assessments. "+
				"If can_modify_dispatch is false and user asks to assign a driver or modify shifts, DO NOT call assignment tool; politely refuse in English explaining that only Dispatchers and Admins can modify shifts. "+
				"If can_access_payroll is false and user asks about payroll or compensation, politely refuse in English stating insufficient permissions. "+
				"ALWAYS answer in English. When assigning drivers, important actions MUST be confirmed before actual execution.",
			req.Date, normRole, canModifyDispatch, canAccessPayroll, canAccessHR,
		)
	}

	payload := map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]interface{}{
				{"text": systemPrompt},
			},
		},
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": req.Message},
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := s.httpClient.Do(httpReq)
	if err != nil || res.StatusCode != 200 {
		return nil, fmt.Errorf("gemini api failed: %v", err)
	}
	defer res.Body.Close()

	bodyBytes, _ := io.ReadAll(res.Body)
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		return nil, fmt.Errorf("invalid gemini response")
	}

	reply := ""
	if len(geminiResp.Candidates[0].Content.Parts) > 0 {
		reply = geminiResp.Candidates[0].Content.Parts[0].Text
	}

	suggested := []string{"Which shifts have no driver today?", "View today's dispatch overview"}
	if isZh {
		suggested = []string{"今天有哪些班次缺少司机？", "查看今日调度总览", "查看车队车辆状态"}
	} else if isFr {
		suggested = []string{"Quels quarts n'ont pas de chauffeur aujourd'hui ?", "Voir la vue d'ensemble du dispatch"}
	}

	return &models.AIChatResponse{
		Reply:              reply,
		SuggestedQuestions: suggested,
	}, nil
}
