import React, { useState } from "react";
import { useJobNex } from "@/frontend/context/JobNexContext";
import {
  Send,
  Sparkles,
  CheckCircle2,
  FileText,
  Mail,
  Building,
  UserCheck,
  RotateCw,
} from "lucide-react";

export function ColdReferralView() {
  const { referrals, generateReferralDraft, sendReferral, uploadedResumeName, currentUser } =
    useJobNex();

  const [company, setCompany] = useState("Google");
  const [recipientEmail, setRecipientEmail] = useState("hiring@google.com");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [subject, setSubject] = useState("Referral for Software Engineer Position");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setMessageBody(generateReferralDraft(company, targetRole, recipientEmail));
    setSubject(`Referral for ${targetRole} Position - ${currentUser.name}`);
  }, [company, targetRole, recipientEmail, currentUser.name, generateReferralDraft]);

  const handleRegenerateDraft = () => {
    setMessageBody(generateReferralDraft(company, targetRole, recipientEmail));
  };

  const handleSubmitSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !recipientEmail || !messageBody || isSending) return;

    setIsSending(true);
    await sendReferral(company, targetRole, recipientEmail, subject, messageBody);
    setIsSending(false);

    setConfirmationMessage(
      `Confirmation message -> Email sent to ${recipientEmail} with ${uploadedResumeName} attached!`,
    );
    setTimeout(() => {
      setConfirmationMessage(null);
    }, 4500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md ">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Referral Outreach
            </h1>
            <p className="text-xs text-slate-700">
              Draft tailored referral requests that highlight your strengths
            </p>
          </div>
        </div>
      </div>

      {confirmationMessage && (
        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{confirmationMessage}</span>
        </div>
      )}

      {/* Main Referral Form */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-600" />
            <h2 className="text-base font-semibold text-slate-900">Compose Referral Outreach</h2>
          </div>
          <button
            type="button"
            onClick={handleRegenerateDraft}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 border border-brand-300 rounded-md px-2.5 py-1.5 hover:bg-brand-50 hover:border-brand-400 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Regenerate with AI</span>
          </button>
        </div>

        <form onSubmit={handleSubmitSend} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company</label>
              <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-brand-500">
                <Building className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google, Amazon"
                  className="w-full text-xs text-slate-900 outline-none bg-transparent font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Email</label>
              <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-brand-500">
                <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="hiring@google.com"
                  className="w-full text-xs text-slate-900 outline-none bg-transparent font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Role</label>
              <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-brand-500">
                <UserCheck className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  required
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="Software Engineer"
                  className="w-full text-xs text-slate-900 outline-none bg-transparent font-medium"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Personalized Referral Message Body
            </label>
            <textarea
              rows={8}
              required
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 outline-none focus:border-brand-500 focus:bg-white transition-all font-mono leading-relaxed resize-none"
            />
          </div>

          <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-brand-600" />
              <div>
                <p className="text-xs font-bold text-brand-900">Attached: {uploadedResumeName}</p>
                <p className="text-[10px] text-brand-700">
                  PDF document will be attached to outbound dispatch
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Ready
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSending}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-8 py-3 rounded-xl shadow-md  transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Referral Dispatch History */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Delivery Status & History</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                <th className="py-2.5 px-4">Company</th>
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-bold text-slate-900">{ref.company}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    {ref.recipientEmail}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{ref.targetRole}</td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {ref.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 text-[11px]">
                    {ref.sentAt || "Just now"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
