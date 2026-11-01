package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type UploadResponse struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

type Base64UploadRequest struct {
	Filename string `json:"filename"`
	Data     string `json:"data"` // base64 encoded data or data URI
	Folder   string `json:"folder,omitempty"`
}

var (
	UploadDir           = resolveUploadDir()
	MaxUploadSize int64 = 32 << 20 // 32 MB max
)

func resolveUploadDir() string {
	if dir := uploadDirFromEnv(); dir != "" {
		return dir
	}
	if root := findServerModuleRoot(); root != "" {
		return filepath.Join(root, "uploads")
	}
	abs, err := filepath.Abs("uploads")
	if err != nil {
		return "uploads"
	}
	return abs
}

// ActiveUploadDir returns the directory used for the current request.
// UPLOAD_DIR and UPLOADS_DIR override the directory chosen at startup.
func ActiveUploadDir() string {
	if dir := uploadDirFromEnv(); dir != "" {
		return dir
	}
	return UploadDir
}

func uploadDirFromEnv() string {
	dir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if dir == "" {
		dir = strings.TrimSpace(os.Getenv("UPLOADS_DIR"))
	}
	if dir == "" {
		return ""
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return dir
	}
	return abs
}

func findServerModuleRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for i := 0; i < 8; i++ {
		if isServerModule(dir) {
			return dir
		}
		nested := filepath.Join(dir, "server")
		if isServerModule(nested) {
			return nested
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
	return ""
}

func isServerModule(dir string) bool {
	return fileExists(filepath.Join(dir, "go.mod")) && fileExists(filepath.Join(dir, "cmd", "server", "main.go"))
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

var allowedUploadExts = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".pdf":  true,
	".mp4":  true,
	".mov":  true,
	".txt":  true,
	".csv":  true,
}

// EnsureUploadDir ensures the upload destination directory exists.
func EnsureUploadDir() error {
	return os.MkdirAll(ActiveUploadDir(), 0755)
}

// UploadFileHandler handles multipart/form-data and base64 JSON file uploads.
func UploadFileHandler(w http.ResponseWriter, r *http.Request) {
	if err := EnsureUploadDir(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to initialize upload directory: %v", err), http.StatusInternalServerError)
		return
	}

	contentType := r.Header.Get("Content-Type")

	// Support JSON base64 upload
	if strings.HasPrefix(contentType, "application/json") {
		handleBase64Upload(w, r)
		return
	}

	// Support multipart/form-data upload
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)
	if err := r.ParseMultipartForm(MaxUploadSize); err != nil {
		http.Error(w, fmt.Sprintf("File too large or invalid multipart form: %v", err), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		// Try alternative form keys
		file, header, err = r.FormFile("attachment")
		if err != nil {
			file, header, err = r.FormFile("photo")
			if err != nil {
				http.Error(w, "No file provided in form data (expected field 'file', 'attachment', or 'photo')", http.StatusBadRequest)
				return
			}
		}
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	if !allowedUploadExts[ext] {
		http.Error(w, fmt.Sprintf("File extension %q is not allowed for security reasons", ext), http.StatusBadRequest)
		return
	}

	randBytes := make([]byte, 6)
	_, _ = rand.Read(randBytes)
	safeFilename := fmt.Sprintf("att_%d_%s%s", time.Now().UnixMilli(), hex.EncodeToString(randBytes), ext)
	if err := EnsureUploadDir(); err != nil {
		http.Error(w, `{"error":"upload directory is unavailable"}`, http.StatusInternalServerError)
		return
	}
	destPath := filepath.Join(ActiveUploadDir(), safeFilename)

	destFile, err := os.Create(destPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to save file: %v", err), http.StatusInternalServerError)
		return
	}
	defer destFile.Close()

	written, err := io.Copy(destFile, file)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to write file contents: %v", err), http.StatusInternalServerError)
		return
	}

	baseURL := determineBaseURL(r)
	fileURL := "/uploads/" + safeFilename
	if baseURL != "" {
		fileURL = baseURL + fileURL
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(UploadResponse{
		URL:      fileURL,
		Filename: safeFilename,
		Size:     written,
	})
}

func handleBase64Upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)
	var req Base64UploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	raw := req.Data
	if idx := strings.Index(raw, ";base64,"); idx != -1 {
		raw = raw[idx+8:]
	}

	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid base64 payload: %v", err), http.StatusBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(req.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	if !allowedUploadExts[ext] {
		http.Error(w, fmt.Sprintf("File extension %q is not allowed for security reasons", ext), http.StatusBadRequest)
		return
	}

	randBytes := make([]byte, 6)
	_, _ = rand.Read(randBytes)
	safeFilename := fmt.Sprintf("att_%d_%s%s", time.Now().UnixMilli(), hex.EncodeToString(randBytes), ext)
	if err := EnsureUploadDir(); err != nil {
		http.Error(w, `{"error":"upload directory is unavailable"}`, http.StatusInternalServerError)
		return
	}
	destPath := filepath.Join(ActiveUploadDir(), safeFilename)

	if err := os.WriteFile(destPath, decoded, 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write file: %v", err), http.StatusInternalServerError)
		return
	}

	baseURL := determineBaseURL(r)
	fileURL := "/uploads/" + safeFilename
	if baseURL != "" {
		fileURL = baseURL + fileURL
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(UploadResponse{
		URL:      fileURL,
		Filename: safeFilename,
		Size:     int64(len(decoded)),
	})
}

func determineBaseURL(r *http.Request) string {
	if base := strings.TrimRight(strings.TrimSpace(os.Getenv("APP_BASE_URL")), "/"); base != "" {
		return base
	}
	if base := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/"); base != "" {
		return base
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("APP_MODE")), "production") {
		return ""
	}
	host := strings.TrimSpace(r.Host)
	if !safeDevHost(host) {
		host = "localhost:8080"
	}
	return "http://" + host
}

func safeDevHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	return host == "localhost:8080" || host == "127.0.0.1:8080" || host == "localhost" || host == "127.0.0.1"
}
