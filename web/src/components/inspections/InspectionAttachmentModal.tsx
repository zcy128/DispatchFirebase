import React, { useState, useRef } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Upload,
  Download,
  Trash2,
  ExternalLink,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  VehicleInspectionRecord,
  PreventiveMaintenanceRecord,
  InspectionAttachment,
  InspectionAttachmentCategory
} from '../../types/vehicleInspection';
import { useI18n } from '../../contexts/I18nContext';

interface InspectionAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: VehicleInspectionRecord | PreventiveMaintenanceRecord | null;
  onAddAttachment: (recordId: string, attachment: InspectionAttachment) => Promise<void>;
  onDeleteAttachment: (recordId: string, attachmentId: string) => Promise<void>;
}

export const InspectionAttachmentModal: React.FC<InspectionAttachmentModalProps> = ({
  isOpen,
  onClose,
  inspection,
  onAddAttachment,
  onDeleteAttachment
}) => {
  const { isFrench } = useI18n();
  const [selectedAttachment, setSelectedAttachment] = useState<InspectionAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isPMRecord = inspection ? 'serviceTier' in inspection : false;
  const [uploadCategory, setUploadCategory] = useState<InspectionAttachmentCategory>(
    isPMRecord ? 'work_order' : 'certificate'
  );
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !inspection) return null;

  const attachments = inspection.attachments || [];

  const getCategoryLabel = (cat: InspectionAttachmentCategory): string => {
    switch (cat) {
      case 'certificate':
        return inspection.province === 'QC'
          ? 'Certificat CVM SAAQ'
          : isFrench
          ? 'Certificat de sécurité DriveON'
          : 'DriveON Safety Certificate';
      case 'measurements':
        return isFrench ? 'Rapport de mesures freins et pneus' : 'Brake & Tire Measurement Report';
      case 'repair_proof':
        return isFrench ? 'Preuve des réparations' : 'Proof of Repairs';
      case 'sticker_photo':
        return isFrench ? 'Photo de la vignette perforée' : 'Punched Decal / Sticker Photo';
      case 'fiche_entretien':
        return isFrench ? 'Fiche d\'entretien SAAQ (Signée)' : 'SAAQ Fiche d\'entretien (Signed)';
      case 'work_order':
        return isFrench ? 'Bon de travail d\'entretien préventif' : 'Preventive Maintenance Work Order';
      case 'parts_invoice':
        return isFrench ? 'Facture d\'huile moteur / filtre / pièces' : 'Engine Oil / Filter / Parts Invoice';
      default:
        return isFrench ? 'Document justificatif' : 'Supporting Document';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 15MB
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(isFrench ? 'La taille du fichier dépasse la limite de 15 Mo.' : 'File size exceeds 15MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');

      if (!isPdf && !isImg) {
        throw new Error(
          isFrench
            ? 'Veuillez téléverser un document PDF ou un fichier image (PNG/JPG/WEBP).'
            : 'Please upload a PDF document or an image file (PNG/JPG/WEBP).'
        );
      }

      // Convert file to base64 DataURL for offline persistence & instant rendering
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const newAtt: InspectionAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            category: uploadCategory,
            categoryLabel: getCategoryLabel(uploadCategory),
            type: isPdf ? 'pdf' : 'image',
            mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
            size: file.size,
            dataUrl,
            uploadedAt: new Date().toISOString(),
            uploadedBy: isFrench ? 'Responsable de la sécurité de la flotte' : 'Fleet Safety Officer',
            description: uploadDescription || undefined
          };

          await onAddAttachment(inspection.id, newAtt);
          setStatusMessage(
            isFrench
              ? `Pièce jointe « ${file.name} » téléversée avec succès.`
              : `Attachment "${file.name}" uploaded successfully.`
          );
          setUploadDescription('');
          if (fileInputRef.current) fileInputRef.current.value = '';
          setSelectedAttachment(newAtt);
          setTimeout(() => setStatusMessage(null), 3500);
        } catch (err: any) {
          setUploadError(err.message || (isFrench ? 'Échec de l\'enregistrement de la pièce jointe' : 'Failed to save attachment'));
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError(isFrench ? 'Échec de la lecture du fichier.' : 'Failed to read file from browser.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || (isFrench ? 'Échec du traitement du fichier' : 'Failed to process file'));
      setIsUploading(false);
    }
  };

  const handleDelete = async (attId: string, attName: string) => {
    if (
      !confirm(
        isFrench
          ? `Êtes-vous sûr de vouloir supprimer la pièce jointe « ${attName} » ?`
          : `Are you sure you want to delete attachment "${attName}"?`
      )
    )
      return;
    try {
      await onDeleteAttachment(inspection.id, attId);
      if (selectedAttachment?.id === attId) {
        setSelectedAttachment(null);
      }
      setStatusMessage(isFrench ? 'Pièce jointe supprimée.' : 'Attachment deleted.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setUploadError(err.message || (isFrench ? 'Échec de la suppression' : 'Failed to delete attachment'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {isFrench
                    ? `Unité #${inspection.unitNumber} - Pièces jointes (${
                        'stickerMonth' in inspection ? 'Inspection mécanique' : 'Entretien préventif (EP)'
                      })`
                    : `Unit #${inspection.unitNumber} - ${
                        'stickerMonth' in inspection ? 'Mechanical Inspection' : 'Preventive Maintenance (PM)'
                      } Attachments`}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  {'stickerMonth' in inspection
                    ? `${isFrench ? 'Vignette' : 'Sticker'}: ${inspection.stickerMonth}`
                    : `${inspection.serviceTier} • ${inspection.serviceDate}`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFrench
                  ? 'Téléversez et consultez les certificats PDF, Fiche d\'entretien SAAQ, bons de travail signés, factures d\'huile/filtres et photos de vignette.'
                  : 'Upload & review PDF certificates, SAAQ Fiche d\'entretien, signed work orders, oil/filter invoices, and decal photos.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload New Attachment Box */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>
                  {isFrench
                    ? 'Téléverser une nouvelle pièce jointe (PDF ou image)'
                    : 'Upload New Attachment (PDF or Image)'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">PDF, PNG, JPG, WEBP (Max 15MB)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Catégorie du document' : 'Attachment Category'}
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as InspectionAttachmentCategory)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="work_order">
                    {isFrench ? '🛠️ Bon de travail d\'entretien préventif' : '🛠️ Preventive Maintenance Work Order'}
                  </option>
                  <option value="parts_invoice">
                    {isFrench ? '🧾 Facture d\'huile moteur / filtre / pièces' : '🧾 Engine Oil / Filter / Parts Invoice'}
                  </option>
                  <option value="fiche_entretien">
                    {isFrench ? '⚜️ Fiche d\'entretien SAAQ (Signée)' : '⚜️ SAAQ Fiche d\'entretien (Signed Checklist)'}
                  </option>
                  <option value="certificate">
                    {inspection.province === 'QC'
                      ? '📜 Certificat CVM SAAQ'
                      : isFrench
                      ? '📜 Certificat de sécurité DriveON (PDF)'
                      : '📜 DriveON Safety Certificate (PDF)'}
                  </option>
                  <option value="measurements">
                    {isFrench ? '📐 Rapport de mesures freins et pneus' : '📐 Brake & Tire Measurements Sheet'}
                  </option>
                  <option value="repair_proof">
                    {isFrench ? '🔧 Preuve des réparations de défectuosités' : '🔧 Proof of Defect Repairs'}
                  </option>
                  <option value="sticker_photo">
                    {isFrench ? '🏷️ Photo de la vignette perforée' : '🏷️ Punched Decal / Sticker Photo'}
                  </option>
                  <option value="other">
                    {isFrench ? '📁 Autre document justificatif' : '📁 Other Supporting Document'}
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Description / Note (Optionnel)' : 'Description / Note (Optional)'}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder={
                      isFrench
                        ? 'ex. Rapport DriveON ou facture d\'huile 15W-40...'
                        : 'e.g. Technician DriveON report with brake thickness readings...'
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="inspection-file-upload-input"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shrink-0 flex items-center space-x-1.5 disabled:opacity-50 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {isUploading
                        ? isFrench
                          ? 'Lecture...'
                          : 'Reading...'
                        : isFrench
                        ? 'Choisir un fichier'
                        : 'Choose File & Add'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            {statusMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>

          {/* Attachments List and Preview Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left Column: Attachment Thumbnails / Cards */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>
                  {isFrench ? `Fichiers existants (${attachments.length})` : `Existing Files (${attachments.length})`}
                </span>
                <span className="text-[10px] text-slate-500">
                  {isFrench ? 'Cliquer pour prévisualiser' : 'Click to preview'}
                </span>
              </div>

              {attachments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 border border-slate-800 rounded-xl">
                  {isFrench
                    ? 'Aucune pièce jointe téléversée. Ajoutez un certificat PDF ou une facture ci-dessus.'
                    : 'No attachments uploaded yet. Upload a PDF certificate or brake measurement photo above.'}
                </div>
              ) : (
                attachments.map((att) => {
                  const isSelected = selectedAttachment?.id === att.id;
                  const isPdf = att.type === 'pdf';
                  return (
                    <div
                      key={att.id}
                      onClick={() => setSelectedAttachment(att)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/20 text-white'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5 overflow-hidden">
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isPdf ? 'bg-rose-500/15 text-rose-400' : 'bg-sky-500/15 text-sky-400'
                        }`}>
                          {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-bold truncate" title={att.name}>{att.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 mr-1.5">
                              {getCategoryLabel(att.category).split(' ')[0]}
                            </span>
                            <span>{formatFileSize(att.size)}</span>
                          </div>
                          {att.description && (
                            <div className="text-[10px] text-slate-500 truncate mt-0.5">{att.description}</div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(att.id, att.name);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition shrink-0"
                        title={isFrench ? 'Supprimer la pièce jointe' : 'Delete attachment'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Active Preview Pane */}
            <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[380px]">
              {selectedAttachment ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="font-bold text-white text-xs flex items-center space-x-2">
                        <span>{selectedAttachment.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {selectedAttachment.type.toUpperCase()} • {formatFileSize(selectedAttachment.size)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {isFrench ? 'Téléversé le' : 'Uploaded'} {selectedAttachment.uploadedAt?.slice(0, 10)}{' '}
                        {isFrench ? 'par' : 'by'} {selectedAttachment.uploadedBy || 'Inspector'}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {selectedAttachment.dataUrl && (
                        <a
                          href={selectedAttachment.dataUrl}
                          download={selectedAttachment.name}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isFrench ? 'Télécharger' : 'Download'}</span>
                        </a>
                      )}
                      {selectedAttachment.dataUrl && (
                        <a
                          href={selectedAttachment.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold flex items-center space-x-1 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{isFrench ? 'Ouvrir' : 'Open Full'}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Render Preview */}
                  <div className="flex-1 flex items-center justify-center bg-slate-900/60 rounded-lg overflow-hidden border border-slate-800 p-2 min-h-[260px]">
                    {selectedAttachment.type === 'pdf' ? (
                      selectedAttachment.dataUrl ? (
                        <iframe
                          src={selectedAttachment.dataUrl}
                          title={selectedAttachment.name}
                          className="w-full h-[320px] rounded border-0"
                        />
                      ) : (
                        <div className="text-center text-xs text-slate-400 space-y-2">
                          <FileText className="w-10 h-10 mx-auto text-rose-400" />
                          <div>
                            {isFrench
                              ? 'Le document PDF est prêt à être téléchargé ou ouvert.'
                              : 'PDF document is ready for download or external viewing.'}
                          </div>
                        </div>
                      )
                    ) : selectedAttachment.dataUrl ? (
                      <img
                        src={selectedAttachment.dataUrl}
                        alt={selectedAttachment.name}
                        className="max-h-[320px] max-w-full object-contain rounded shadow"
                      />
                    ) : (
                      <div className="text-center text-xs text-slate-400 space-y-2">
                        <ImageIcon className="w-10 h-10 mx-auto text-sky-400" />
                        <div>{isFrench ? 'Aperçu de l\'image prêt.' : 'Image preview ready.'}</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                  <FileText className="w-8 h-8 opacity-40 text-slate-400" />
                  <span>
                    {isFrench
                      ? 'Sélectionnez une pièce jointe à gauche pour la prévisualiser ici'
                      : 'Select an attachment on the left to preview it here'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {isFrench
              ? 'Les dossiers de plus de 2 ans sont automatiquement archivés dans BigQuery.'
              : 'Records older than 2 years are automatically marked for BigQuery cold storage.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition"
          >
            {isFrench ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
