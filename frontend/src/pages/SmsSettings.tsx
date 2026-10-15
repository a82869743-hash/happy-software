import { useState, useEffect } from 'react';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import api from '../api/axios';

interface SmsSettingsData {
  sms_enabled: string;
  msg91_auth_key: string;
  msg91_sender_id: string;
  msg91_dlt_entity_id: string;
  msg91_job_opened_template_id: string;
  msg91_invoice_template_id: string;
  msg91_status_estimation_template_id: string;
  msg91_status_wip_template_id: string;
  msg91_status_ready_template_id: string;
  msg91_status_delivered_template_id: string;
  msg91_status_invoiced_template_id: string;
  msg91_status_cancelled_template_id: string;
  sms_job_opened_enabled: string;
  sms_status_update_enabled: string;
  sms_invoice_manual_enabled: string;
  sms_template_job_opened: string;
  sms_template_status_estimation: string;
  sms_template_status_wip: string;
  sms_template_status_ready: string;
  sms_template_status_delivered: string;
  sms_template_status_invoiced: string;
  sms_template_status_cancelled: string;
  sms_template_invoice: string;
}

const STATUS_TEMPLATE_FIELDS = [
  { key: 'msg91_status_estimation_template_id', label: 'Estimation', status: 'estimation' },
  { key: 'msg91_status_wip_template_id', label: 'Work in Progress', status: 'wip' },
  { key: 'msg91_status_ready_template_id', label: 'Ready for Delivery', status: 'ready' },
  { key: 'msg91_status_delivered_template_id', label: 'Delivered', status: 'delivered' },
  { key: 'msg91_status_invoiced_template_id', label: 'Invoiced', status: 'invoiced' },
  { key: 'msg91_status_cancelled_template_id', label: 'Cancelled', status: 'cancelled' },
];

export default function SmsSettings() {
  const [settings, setSettings] = useState<Partial<SmsSettingsData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testMobile, setTestMobile] = useState('');
  const [testing, setTesting] = useState(false);
  const [showAuthKey, setShowAuthKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data || {});
    } catch {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { settings });
      showToast('SMS settings saved successfully', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendTestSms = async () => {
    if (!testMobile || testMobile.length < 10) {
      showToast('Enter a valid 10-digit mobile number', 'error');
      return;
    }
    setTesting(true);
    try {
      await api.post('/settings/test-sms', { mobile: testMobile });
      showToast(`Test SMS sent to ${testMobile}`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Test SMS failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const RECOMMENDED_TEMPLATES: Partial<SmsSettingsData> = {
    sms_template_job_opened: 'Dear {#var#}, your vehicle {#var#} has been received at Happy Car Wash. Track live status: {#var#} - HAPPY',
    sms_template_status_estimation: 'Dear {#var#}, estimate for vehicle {#var#} is ready for review: {#var#} - HAPPY',
    sms_template_status_wip: 'Dear {#var#}, service on your vehicle {#var#} is currently in progress at Happy Car Wash. - HAPPY',
    sms_template_status_ready: 'Dear {#var#}, your vehicle {#var#} is ready for delivery at Happy Car Wash, Vadodara. - HAPPY',
    sms_template_status_delivered: 'Dear {#var#}, your vehicle {#var#} has been delivered. Thank you for choosing Happy Car Wash! - HAPPY',
    sms_template_status_invoiced: 'Dear {#var#}, invoice for vehicle {#var#} has been generated. Thank you for your business! - HAPPY',
    sms_template_status_cancelled: 'Dear {#var#}, service for vehicle {#var#} has been cancelled. Please contact us for details. - HAPPY',
    sms_template_invoice: 'Dear {#var#}, invoice {#var#} for vehicle {#var#} amounting to Rs.{#var#} is ready. Thank you - Happy Car Wash. - HAPPY',
  };

  const handleResetDefaults = () => {
    setSettings(prev => ({ ...prev, ...RECOMMENDED_TEMPLATES }));
    showToast('Reset to recommended default templates', 'info');
  };

  if (loading) {
    return (
      <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8">
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12">
      <div className="space-y-6 max-w-4xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-on-surface font-headline">SMS Notifications</h1>
            <p className="text-sm text-on-surface-muted mt-0.5">Configure MSG91 SMS alerts and clean message templates</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResetDefaults}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Reset templates to recommended DLT format"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              Reset Defaults
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">
                {saving ? 'progress_activity' : 'save'}
              </span>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* DLT Registration Warning Banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
          <span className="material-symbols-outlined text-amber-500 text-xl flex-shrink-0 mt-0.5">warning</span>
          <div>
            <p className="text-sm font-bold text-amber-500">DLT Registration Required Before Activating SMS</p>
            <p className="text-xs text-on-surface-muted mt-1">
              In India, all transactional SMS require TRAI DLT registration. You need: 
              (1) Entity ID from DLT portal, (2) Sender ID approved (HAPPY), 
              (3) Separate Template ID for each message type below. 
              See <strong>SMS_DLT_SETUP_GUIDE.md</strong> in this project for step-by-step instructions.
            </p>
          </div>
        </div>

        {/* Global SMS Toggle */}
        <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xs font-bold text-on-surface-muted uppercase tracking-wider mb-4">Global Controls</h2>
          <div className="space-y-3">
            {[
              { key: 'sms_enabled', label: 'Enable SMS Notifications', desc: 'Master switch for all SMS dispatches' },
              { key: 'sms_job_opened_enabled', label: 'Job Card Opened SMS', desc: 'Send tracking link when a new job card is created' },
              { key: 'sms_status_update_enabled', label: 'Status Update SMS', desc: 'Auto-send SMS on every pipeline status change' },
              { key: 'sms_invoice_manual_enabled', label: 'Invoice SMS (Manual)', desc: 'Allow admin to send invoice SMS from job card detail' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{label}</p>
                  <p className="text-xs text-on-surface-muted">{desc}</p>
                </div>
                <button
                  onClick={() => updateField(key, settings[key as keyof SmsSettingsData] === 'true' ? 'false' : 'true')}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings[key as keyof SmsSettingsData] === 'true' ? 'bg-primary' : 'bg-[#e2e8f0]'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings[key as keyof SmsSettingsData] === 'true' ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* MSG91 Credentials */}
        <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xs font-bold text-on-surface-muted uppercase tracking-wider mb-4">MSG91 Credentials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-muted mb-1.5">AUTH KEY</label>
              <div className="relative">
                <input
                  type={showAuthKey ? 'text' : 'password'}
                  value={settings.msg91_auth_key || ''}
                  onChange={e => updateField('msg91_auth_key', e.target.value)}
                  placeholder="Enter MSG91 Auth Key"
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthKey(!showAuthKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-muted"
                >
                  <span className="material-symbols-outlined text-sm">{showAuthKey ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-muted mb-1.5">SENDER ID (DLT Approved Header)</label>
              <input
                type="text"
                value={settings.msg91_sender_id || 'HAPPY'}
                onChange={e => updateField('msg91_sender_id', e.target.value.toUpperCase())}
                placeholder="HAPPY"
                maxLength={6}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm font-mono"
              />
              <p className="text-[10px] text-on-surface-muted mt-1">Max 6 characters. Must match DLT registered header exactly.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-muted mb-1.5">DLT ENTITY ID (Telemarketer Registration Number)</label>
              <input
                type="text"
                value={settings.msg91_dlt_entity_id || ''}
                onChange={e => updateField('msg91_dlt_entity_id', e.target.value)}
                placeholder="Your DLT Entity ID from TRAI portal"
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* DLT Template IDs */}
        <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xs font-bold text-on-surface-muted uppercase tracking-wider mb-1">DLT Template IDs</h2>
          <p className="text-xs text-on-surface-muted mb-4">
            Each event requires a separate DLT-approved template ID from your MSG91 / DLT portal.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-muted mb-1.5">JOB CARD OPENED</label>
              <input
                type="text"
                value={settings.msg91_job_opened_template_id || ''}
                onChange={e => updateField('msg91_job_opened_template_id', e.target.value)}
                placeholder="DLT Template ID"
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-muted mb-1.5">INVOICE SMS</label>
              <input
                type="text"
                value={settings.msg91_invoice_template_id || ''}
                onChange={e => updateField('msg91_invoice_template_id', e.target.value)}
                placeholder="DLT Template ID"
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm font-mono"
              />
            </div>
            {STATUS_TEMPLATE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-on-surface-muted mb-1.5">STATUS: {label.toUpperCase()}</label>
                <input
                  type="text"
                  value={settings[key as keyof SmsSettingsData] || ''}
                  onChange={e => updateField(key, e.target.value)}
                  placeholder="DLT Template ID"
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Test SMS */}
        <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xs font-bold text-on-surface-muted uppercase tracking-wider mb-4">Test SMS Configuration</h2>
          <p className="text-xs text-on-surface-muted mb-4">
            Send a test SMS to verify your credentials are working. Uses the WIP status template.
            Save your settings before testing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="tel"
              value={testMobile}
              onChange={e => setTestMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              className="flex-1 rounded-xl border border-border bg-input px-4 py-2.5 text-sm"
            />
            <button
              onClick={sendTestSms}
              disabled={testing || !testMobile}
              className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">
                {testing ? 'progress_activity' : 'sms'}
              </span>
              {testing ? 'Sending...' : 'Send Test SMS'}
            </button>
          </div>
        </div>

        {/* Message Templates Preview */}
        <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xs font-bold text-on-surface-muted uppercase tracking-wider mb-2">Message Templates</h2>
          <p className="text-xs text-on-surface-muted mb-4">
            These templates are stored in the database. {'{#var#}'} are placeholders replaced with actual data at send time.
            These must EXACTLY match what you registered on the DLT portal.
          </p>
          <div className="space-y-3">
            {[
              { key: 'sms_template_job_opened', label: 'Job Opened (vars: Name, RegNo, TrackingURL)' },
              { key: 'sms_template_status_estimation', label: 'Status: Estimation (vars: Name, RegNo)' },
              { key: 'sms_template_status_wip', label: 'Status: WIP (vars: Name, RegNo)' },
              { key: 'sms_template_status_ready', label: 'Status: Ready (vars: Name, RegNo)' },
              { key: 'sms_template_status_delivered', label: 'Status: Delivered (vars: Name, RegNo)' },
              { key: 'sms_template_status_invoiced', label: 'Status: Invoiced (vars: Name, RegNo)' },
              { key: 'sms_template_status_cancelled', label: 'Status: Cancelled (vars: Name, RegNo)' },
              { key: 'sms_template_invoice', label: 'Invoice SMS (vars: Name, InvoiceNo, RegNo, Amount)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-on-surface-muted mb-1">{label}</label>
                <textarea
                  value={settings[key as keyof SmsSettingsData] || ''}
                  onChange={e => updateField(key, e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-xs font-mono resize-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save Footer */}
        <div className="flex justify-end pb-6">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">{saving ? 'progress_activity' : 'save'}</span>
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>
    </AnimatedPage>
  );
}

