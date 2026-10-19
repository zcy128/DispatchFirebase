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

const (
	UploadDir     = "./uploads"
	MaxUploadSize = 32 << 20 // 32 MB max
)

// EnsureUploadDir ensures the upload destination directory exists.
func EnsureUploadDir() error {
	return os.MkdirAll(UploadDir, 0755)
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

	randBytes := make([]byte, 6)
	_, _ = rand.Read(randBytes)
	safeFilename := fmt.Sprintf("att_%d_%s%s", time.Now().UnixMilli(), hex.EncodeToString(randBytes), ext)
	destPath := filepath.Join(UploadDir, safeFilename)

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
	fileURL := fmt.Sprintf("%s/uploads/%s", baseURL, safeFilename)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(UploadResponse{
		URL:      fileURL,
		Filename: safeFilename,
		Size:     written,
	})
}

func handleBase64Upload(w http.ResponseWriter, r *http.Request) {
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

	randBytes := make([]byte, 6)
	_, _ = rand.Read(randBytes)
	safeFilename := fmt.Sprintf("att_%d_%s%s", time.Now().UnixMilli(), hex.EncodeToString(randBytes), ext)
	destPath := filepath.Join(UploadDir, safeFilename)

	if err := os.WriteFile(destPath, decoded, 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write file: %v", err), http.StatusInternalServerError)
		return
	}

	baseURL := determineBaseURL(r)
	fileURL := fmt.Sprintf("%s/uploads/%s", baseURL, safeFilename)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(UploadResponse{
		URL:      fileURL,
		Filename: safeFilename,
		Size:     int64(len(decoded)),
	})
}

func determineBaseURL(r *http.Request) string {
	proto := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		proto = "https"
	}
	host := r.Host
	if host == "" {
		host = "localhost:8080"
	}
	return fmt.Sprintf("%s://%s", proto, host)
}
