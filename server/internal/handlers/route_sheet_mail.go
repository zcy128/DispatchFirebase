package handlers

import (
	"encoding/base64"
	"encoding/json"
	"html"
	"net/http"
	"net/mail"
	"strings"

	"github.com/go-chi/chi/v5"
)

const maxRouteSheetBytes = 4_000_000

type routeSheetMailer interface {
	SendEmailWithAttachment(to []string, subject, htmlBody, textBody, fileName string, attachment []byte) (bool, error)
}

type shareRouteSheetRequest struct {
	To            string `json:"to"`
	RecipientName string `json:"recipientName"`
	RecipientKind string `json:"recipientKind"`
	Subject       string `json:"subject"`
	Note          string `json:"note"`
	FileName      string `json:"fileName"`
	PdfBase64     string `json:"pdfBase64"`
}

func (h *RouteHandler) UseSheetMailer(mailer routeSheetMailer) {
	h.sheetMailer = mailer
}

func (h *RouteHandler) ShareRouteSheet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.sheetMailer == nil {
		http.Error(w, `{"error":"route sheet email is not available"}`, http.StatusServiceUnavailable)
		return
	}
	routeID := strings.TrimSpace(chi.URLParam(r, "id"))
	if routeID == "" {
		http.Error(w, `{"error":"route id is required"}`, http.StatusBadRequest)
		return
	}

	var req shareRouteSheetRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRouteSheetBytes+8192)).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid route sheet request"}`, http.StatusBadRequest)
		return
	}

	kind := strings.ToLower(strings.TrimSpace(req.RecipientKind))
	if kind != "driver" && kind != "office" {
		http.Error(w, `{"error":"recipient must be a driver or an office contact"}`, http.StatusBadRequest)
		return
	}
	address, err := mail.ParseAddress(strings.TrimSpace(req.To))
	if err != nil || !strings.Contains(address.Address, "@") {
		http.Error(w, `{"error":"a valid recipient email is required"}`, http.StatusBadRequest)
		return
	}

	pdf, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.PdfBase64))
	if err != nil || len(pdf) < 5 || string(pdf[:5]) != "%PDF-" || len(pdf) > maxRouteSheetBytes {
		http.Error(w, `{"error":"a route sheet PDF is required"}`, http.StatusBadRequest)
		return
	}

	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "Route sheet " + routeID
	}
	if len(subject) > 200 {
		subject = subject[:200]
	}
	note := strings.TrimSpace(req.Note)
	if len(note) > 2000 {
		note = note[:2000]
	}
	name := strings.TrimSpace(req.RecipientName)
	if name == "" {
		name = address.Address
	}
	fileName := strings.TrimSpace(req.FileName)
	if fileName == "" || strings.Contains(fileName, "/") || strings.Contains(fileName, "\\") {
		fileName = "Route-" + routeID + ".pdf"
	}

	textBody := "Route sheet " + routeID + " is attached for " + name + "."
	if note != "" {
		textBody += "\n\n" + note
	}
	htmlBody := "<p>" + html.EscapeString(textBody) + "</p>"

	simulated, err := h.sheetMailer.SendEmailWithAttachment(
		[]string{address.Address},
		subject,
		htmlBody,
		textBody,
		fileName,
		pdf,
	)
	if err != nil {
		http.Error(w, `{"error":"could not send the route sheet"}`, http.StatusBadGateway)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"simulated": simulated,
	})
}
