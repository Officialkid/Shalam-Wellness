/* ============================================
   SHALAM WELLNESS — book.js
   Multi-step Booking Wizard + Auto-Save Draft
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const DRAFT_KEY = 'sw_booking_draft_v1';
  const WA_NUMBER = '254797431765';

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navOverlay = document.getElementById('navOverlay');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
      navToggle.classList.toggle('active');
    });
  }
  if (navOverlay) {
    navOverlay.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
      navToggle && navToggle.classList.remove('active');
    });
  }

  // Privacy modal
  const privacyOverlay = document.getElementById('privacyOverlay');
  const openPrivacy = document.getElementById('openPrivacy');
  const closePrivacy = document.getElementById('closePrivacy');
  if (openPrivacy && privacyOverlay) {
    openPrivacy.addEventListener('click', () => {
      privacyOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }
  if (closePrivacy && privacyOverlay) {
    closePrivacy.addEventListener('click', () => {
      privacyOverlay.classList.remove('open');
      document.body.style.overflow = '';
    });
    privacyOverlay.addEventListener('click', (e) => {
      if (e.target === privacyOverlay) {
        privacyOverlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  // Elements
  const form = document.getElementById('bookingWizardForm');
  const fname = document.getElementById('fname');
  const fphone = document.getElementById('fphone');
  const femail = document.getElementById('femail');
  const fservice = document.getElementById('fservice');
  const fdate = document.getElementById('fdate');
  const ftime = document.getElementById('ftime');
  const fmessage = document.getElementById('fmessage');
  const formatNotice = document.getElementById('formatNotice');
  const consentConfidentiality = document.getElementById('consentConfidentiality');
  const consentFees = document.getElementById('consentFees');
  const consentFeeText = document.getElementById('consentFeeText');
  const consentFeeCheckboxLabel = document.getElementById('consentFeeCheckboxLabel');

  const stepEls = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3')
  ];
  const stepperItems = document.querySelectorAll('.stepper-item');
  const stepSubtitle = document.getElementById('stepSubtitle');
  const draftStatus = document.getElementById('draftStatus');
  const draftBanner = document.getElementById('draftBanner');
  const clearDraftBtn = document.getElementById('clearDraftBtn');
  const step1Error = document.getElementById('step1Error');
  const step2Error = document.getElementById('step2Error');
  const reviewList = document.getElementById('reviewList');
  const whatsappHandoff = document.getElementById('whatsappHandoff');
  const manualWhatsappLink = document.getElementById('manualWhatsappLink');
  const saveToast = document.getElementById('saveToast');

  let currentStep = 1;

  // Set minimum date to today
  if (fdate) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    fdate.min = `${yyyy}-${mm}-${dd}`;
  }

  function getSelectedFormat() {
    const checked = form.querySelector('input[name="format"]:checked');
    return checked ? checked.value : 'either';
  }

  function getFormatDetails(val) {
    if (val === 'online') return { label: 'Online', rate: 'KES 2,500' };
    if (val === 'inperson') return { label: 'In-Person', rate: 'KES 3,500' };
    if (val === 'custom') return { label: 'Custom', rate: 'To be advised by counsellor' };
    return { label: 'Either (Online / In-Person)', rate: 'KES 2,500 (Online) / KES 3,500 (In-Person)' };
  }

  function updateFormatNotice() {
    const val = getSelectedFormat();
    if (!formatNotice) return;
    if (val === 'online') {
      formatNotice.innerHTML = 'ℹ️ By choosing <strong>Online</strong>, you agree to a session rate of <strong>KES 2,500</strong>.';
      formatNotice.className = 'format-notice show';
    } else if (val === 'inperson') {
      formatNotice.innerHTML = 'ℹ️ By choosing <strong>In-Person</strong>, you agree to a session rate of <strong>KES 3,500</strong>.';
      formatNotice.className = 'format-notice show';
    } else {
      const label = val === 'custom' ? 'Custom' : 'Either';
      formatNotice.innerHTML = `📋 For <strong>${label}</strong>, your session rate will be advised by your counsellor.`;
      formatNotice.className = 'format-notice show advisory';
    }
    updateConsentFeeText();
  }

  function updateConsentFeeText() {
    const { label, rate } = getFormatDetails(getSelectedFormat());
    if (consentFeeText) {
      consentFeeText.innerHTML = `Selected format: <strong>${label}</strong> — Applicable rate: <strong>${rate}</strong>.`;
    }
    if (consentFeeCheckboxLabel) {
      consentFeeCheckboxLabel.innerHTML = `I acknowledge the applicable session rate (<strong>${rate}</strong>) and consent to proceed with this booking request.`;
    }
  }

  // Save draft to localStorage
  function saveDraft() {
    const draft = {
      step: currentStep,
      fname: fname.value,
      fphone: fphone.value,
      femail: femail.value,
      fservice: fservice.value,
      format: getSelectedFormat(),
      fdate: fdate.value,
      ftime: ftime.value,
      fmessage: fmessage.value,
      consentConfidentiality: consentConfidentiality.checked,
      consentFees: consentFees.checked,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      if (draftStatus) {
        draftStatus.textContent = '✓ Progress saved';
      }
    } catch (_) {
      // Ignore storage quota errors
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    form.reset();
    const eitherRadio = form.querySelector('input[name="format"][value="either"]');
    if (eitherRadio) eitherRadio.checked = true;
    draftBanner.hidden = true;
    if (draftStatus) draftStatus.textContent = 'Auto-save on';
    updateFormatNotice();
    goToStep(1, false);
  }

  function restoreDraft() {
    // Check URL query for pre-selected service
    const params = new URLSearchParams(window.location.search);
    const urlService = params.get('service');

    let restored = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const hasAnyData = d.fname || d.fphone || d.femail || d.fservice || d.fdate || d.ftime || d.fmessage;
        if (hasAnyData) {
          fname.value = d.fname || '';
          fphone.value = d.fphone || '';
          femail.value = d.femail || '';
          fservice.value = d.fservice || '';
          fdate.value = d.fdate || '';
          ftime.value = d.ftime || '';
          fmessage.value = d.fmessage || '';
          consentConfidentiality.checked = Boolean(d.consentConfidentiality);
          consentFees.checked = Boolean(d.consentFees);

          if (d.format) {
            const r = form.querySelector(`input[name="format"][value="${d.format}"]`);
            if (r) r.checked = true;
          }

          draftBanner.hidden = false;
          if (draftStatus) draftStatus.textContent = '✓ Draft restored';
          restored = true;

          // Restore step if valid
          const targetStep = Number(d.step) || 1;
          if (targetStep === 3 && validateStep1(true) && validateStep2(true)) {
            goToStep(3, false);
          } else if (targetStep === 2 && validateStep1(true)) {
            goToStep(2, false);
          } else {
            goToStep(1, false);
          }
        }
      }
    } catch (_) {
      // Ignore malformed draft
    }

    if (!restored && urlService) {
      const optionExists = Array.from(fservice.options).some(opt => opt.value === urlService);
      if (optionExists) {
        fservice.value = urlService;
      }
    }

    updateFormatNotice();
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  function hideError(el) {
    el.hidden = true;
    el.textContent = '';
  }

  function validateStep1(silent = false) {
    if (!silent) hideError(step1Error);
    if (!fname.value.trim()) {
      if (!silent) { showError(step1Error, 'Please enter your full name.'); fname.focus(); }
      return false;
    }
    if (!fphone.value.trim()) {
      if (!silent) { showError(step1Error, 'Please enter your phone or WhatsApp number.'); fphone.focus(); }
      return false;
    }
    if (!fservice.value) {
      if (!silent) { showError(step1Error, 'Please select a service type.'); fservice.focus(); }
      return false;
    }
    if (!fdate.value) {
      if (!silent) { showError(step1Error, 'Please choose your preferred date.'); fdate.focus(); }
      return false;
    }
    if (!ftime.value) {
      if (!silent) { showError(step1Error, 'Please choose your preferred time.'); ftime.focus(); }
      return false;
    }
    return true;
  }

  function validateStep2(silent = false) {
    if (!silent) hideError(step2Error);
    if (!consentConfidentiality.checked || !consentFees.checked) {
      if (!silent) {
        showError(step2Error, 'Please tick both consent checkboxes to continue to review.');
      }
      return false;
    }
    return true;
  }

  function formatReadableDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00').toLocaleDateString('en-KE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function populateReview() {
    const { label, rate } = getFormatDetails(getSelectedFormat());
    const items = [
      { label: 'Full Name', value: fname.value.trim() },
      { label: 'Phone / WhatsApp', value: fphone.value.trim() },
      { label: 'Email Address', value: femail.value.trim() || 'Not provided' },
      { label: 'Service Type', value: fservice.value },
      { label: 'Session Format', value: label },
      { label: 'Session Rate', value: rate },
      { label: 'Preferred Date', value: formatReadableDate(fdate.value) },
      { label: 'Preferred Time', value: ftime.value }
    ];
    if (fmessage.value.trim()) {
      items.push({ label: 'Brief Message', value: fmessage.value.trim(), full: true });
    }

    reviewList.innerHTML = items.map(item => `
      <div class="review-list-item ${item.full ? 'full-width' : ''}">
        <dt>${escapeHtml(item.label)}</dt>
        <dd>${escapeHtml(item.value)}</dd>
      </div>
    `).join('');
  }

  function goToStep(step, shouldSave = true) {
    currentStep = step;
    stepEls.forEach((el, idx) => {
      el.classList.toggle('active', idx + 1 === step);
    });
    stepperItems.forEach((item) => {
      const s = Number(item.dataset.step);
      item.classList.toggle('active', s === step);
      item.classList.toggle('completed', s < step);
    });

    const subtitles = {
      1: 'Step 1 of 3 — Tell us about your session',
      2: 'Step 2 of 3 — Review & confirm consent',
      3: 'Step 3 of 3 — Review your details & send'
    };
    if (stepSubtitle) stepSubtitle.textContent = subtitles[step];

    if (step === 2) updateConsentFeeText();
    if (step === 3) populateReview();
    if (shouldSave) saveDraft();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Build WhatsApp URL (same format as original site)
  function buildWhatsappUrl() {
    const name = fname.value.trim();
    const phone = fphone.value.trim();
    const email = femail.value.trim();
    const service = fservice.value;
    const format = getSelectedFormat();
    const dateFormatted = formatReadableDate(fdate.value);
    const time = ftime.value;
    const message = fmessage.value.trim();

    let waMsg = `Hello Shalam Wellness, I would love to book a session with you! 🌿\n\n`;
    waMsg += `Here are my details:\n\n`;
    waMsg += `📌 Name: ${name}\n`;
    waMsg += `📞 Phone: ${phone}\n`;
    if (email) waMsg += `📧 Email: ${email}\n`;
    waMsg += `🩺 Service: ${service}\n`;
    waMsg += `📍 Format: ${format.charAt(0).toUpperCase() + format.slice(1)}\n`;
    waMsg += `📅 Preferred Date: ${dateFormatted}\n`;
    waMsg += `⏰ Preferred Time: ${time}\n`;
    waMsg += `✅ Consent & Confidentiality: Confirmed\n`;
    if (message) waMsg += `\n💬 Note: ${message}`;

    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;
  }

  // Event Listeners
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input', saveDraft);
    field.addEventListener('change', () => {
      if (field.name === 'format') updateFormatNotice();
      saveDraft();
    });
  });

  document.getElementById('toStep2Btn').addEventListener('click', () => {
    if (validateStep1()) goToStep(2);
  });

  document.getElementById('backToStep1Btn').addEventListener('click', () => goToStep(1));

  document.getElementById('toStep3Btn').addEventListener('click', () => {
    if (validateStep2()) goToStep(3);
  });

  document.getElementById('backToStep2Btn').addEventListener('click', () => goToStep(2));
  document.getElementById('editFromReviewBtn').addEventListener('click', () => goToStep(1));

  clearDraftBtn.addEventListener('click', clearDraft);

  document.getElementById('saveLaterBtn1').addEventListener('click', () => {
    saveDraft();
    saveToast.hidden = false;
    setTimeout(() => { saveToast.hidden = true; }, 4500);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    const waUrl = buildWhatsappUrl();
    manualWhatsappLink.href = waUrl;

    // Hide form & stepper, show WhatsApp handoff screen
    form.style.display = 'none';
    document.querySelector('.wizard-stepper').style.display = 'none';
    draftBanner.hidden = true;
    whatsappHandoff.hidden = false;
    if (stepSubtitle) stepSubtitle.textContent = 'Redirecting to WhatsApp';
    if (draftStatus) draftStatus.textContent = '✓ Ready to send';

    // Clear saved draft since booking is complete
    localStorage.removeItem(DRAFT_KEY);

    // Open WhatsApp after brief visual confirmation so user sees they are going to WhatsApp
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 650);
  });

  document.getElementById('bookAnotherBtn').addEventListener('click', () => {
    whatsappHandoff.hidden = true;
    form.style.display = '';
    document.querySelector('.wizard-stepper').style.display = '';
    clearDraft();
  });

  // Initialize
  restoreDraft();
});
