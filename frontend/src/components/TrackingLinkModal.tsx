import { useState } from 'react';
import Modal from './shared/Modal';
import api from '../api/axios';
import { showToast } from './shared/Toast';

interface Props {
  jobNo: string;
  trackingUrl: string;
  jobCardId: number;
  onClose: () => void;
}

export default function TrackingLinkModal({ jobNo, trackingUrl, jobCardId, onClose }: Props) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      showToast('Tracking link copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const sendSMS = async () => {
    setSending(true);
    try {
      await api.post('/quick-job-cards/send-tracking-sms', { job_card_id: jobCardId });
      showToast('Tracking SMS sent to customer', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to send SMS', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title="📲 Customer Tracking Link" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-5">
        {/* Success Badge */}
        <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4 rounded-xl border border-emerald-100">
          <span className="material-symbols-outlined text-2xl text-emerald-600">check_circle</span>
          <div>
            <p className="text-sm font-bold text-emerald-800">Job Card Created</p>
            <p className="text-xs text-emerald-600">{jobNo}</p>
          </div>
        </div>

        {/* Tracking URL Display */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Tracking URL
          </label>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1.5 border border-slate-200">
            <input
              type="text"
              readOnly
              value={trackingUrl}
              className="flex-1 bg-transparent border-none text-xs font-mono text-slate-700 px-3 py-2 focus:ring-0"
            />
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                copied
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copied ? 'done' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Send SMS */}
        <div className="flex items-center justify-between bg-amber-50 px-5 py-3.5 rounded-xl border border-amber-100">
          <div>
            <p className="text-xs font-bold text-amber-800">Send via SMS</p>
            <p className="text-[10px] text-amber-600">Customer will receive the link on their mobile</p>
          </div>
          <button
            onClick={sendSMS}
            disabled={sending}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">
              {sending ? 'progress_activity' : 'sms'}
            </span>
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </div>

        {/* Close */}
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-2.5 px-6">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

