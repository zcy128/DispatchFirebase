package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

type fakeSheetMailer struct {
	to         []string
	fileName   string
	attachment []byte
	err        error
}

func (f *fakeSheetMailer) SendEmailWithAttachment(to []string, subject, htmlBody, textBody, fileName string, attachment []byte) (bool, error) {
	f.to = to
	f.fileName = fileName
	f.attachment = attachment
	return true, f.err
}

func shareRequest(t *testing.T, handler http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/routes/CBE-0400/share-sheet", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestShareRouteSheetAcceptsAPdfForADriver(t *testing.T) {
	mailer := &fakeSheetMailer{}
	handler := NewRouteHandler(nil)
	handler.UseSheetMailer(mailer)
	router := chi.NewRouter()
	router.Post("/api/routes/{id}/share-sheet", handler.ShareRouteSheet)

	pdf := base64.StdEncoding.EncodeToString([]byte("%PDF-1.4 route sheet"))
	body := `{"to":"driver@dispatch.local","recipientName":"Robyn Heynen","recipientKind":"driver","subject":"Route sheet CBE-0400","fileName":"Route-CBE-0400.pdf","pdfBase64":"` + pdf + `"}`
	rec := shareRequest(t, router, body)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["simulated"] != true {
		t.Fatalf("simulated = %v", payload["simulated"])
	}
	if len(mailer.to) != 1 || mailer.to[0] != "driver@dispatch.local" {
		t.Fatalf("recipients = %v", mailer.to)
	}
	if string(mailer.attachment[:5]) != "%PDF-" {
		t.Fatalf("attachment = %q", mailer.attachment)
	}
}

func TestShareRouteSheetRejectsOfficeMailWithoutAPdf(t *testing.T) {
	handler := NewRouteHandler(nil)
	handler.UseSheetMailer(&fakeSheetMailer{})
	router := chi.NewRouter()
	router.Post("/api/routes/{id}/share-sheet", handler.ShareRouteSheet)

	rec := shareRequest(t, router, `{"to":"dispatch@dispatch.local","recipientKind":"office","pdfBase64":"bm90IGEgcGRm"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestShareRouteSheetRejectsAnUnknownRecipientKind(t *testing.T) {
	handler := NewRouteHandler(nil)
	handler.UseSheetMailer(&fakeSheetMailer{})
	router := chi.NewRouter()
	router.Post("/api/routes/{id}/share-sheet", handler.ShareRouteSheet)

	pdf := base64.StdEncoding.EncodeToString([]byte("%PDF-1.4"))
	rec := shareRequest(t, router, `{"to":"someone@dispatch.local","recipientKind":"parent","pdfBase64":"`+pdf+`"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}
