package httpjson

import (
	"bytes"
	"net/http"
	"strings"
)

// ErrorContentType keeps JSON error bodies labeled as JSON.
// net/http.Error always sets Content-Type to text/plain, even when the
// handler body is a JSON object. Clients that honor the header then fail
// to parse an otherwise valid error payload.
func ErrorContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &errorContentWriter{ResponseWriter: w}
		next.ServeHTTP(sw, r)
		sw.finish()
	})
}

type errorContentWriter struct {
	http.ResponseWriter
	status int
	hold   bool
	sent   bool
	buf    bytes.Buffer
}

func (w *errorContentWriter) WriteHeader(code int) {
	if w.status != 0 {
		return
	}
	w.status = code
	if code >= 400 && plainOrMissing(w.Header().Get("Content-Type")) {
		w.hold = true
		return
	}
	w.ResponseWriter.WriteHeader(code)
	w.sent = true
}

func (w *errorContentWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	if w.hold && !w.sent {
		return w.buf.Write(p)
	}
	return w.ResponseWriter.Write(p)
}

func (w *errorContentWriter) Flush() {
	w.finish()
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *errorContentWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (w *errorContentWriter) finish() {
	if !w.hold || w.sent {
		return
	}
	if looksLikeJSON(w.buf.Bytes()) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	}
	w.ResponseWriter.WriteHeader(w.status)
	if w.buf.Len() > 0 {
		_, _ = w.ResponseWriter.Write(w.buf.Bytes())
	}
	w.sent = true
}

func plainOrMissing(contentType string) bool {
	contentType = strings.TrimSpace(strings.ToLower(contentType))
	if contentType == "" {
		return true
	}
	mediaType, _, _ := strings.Cut(contentType, ";")
	return strings.TrimSpace(mediaType) == "text/plain"
}

func looksLikeJSON(body []byte) bool {
	trimmed := bytes.TrimSpace(body)
	return len(trimmed) > 0 && (trimmed[0] == '{' || trimmed[0] == '[')
}
