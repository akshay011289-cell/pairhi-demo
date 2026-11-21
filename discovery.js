/* =====================================================
   PAIRHI DISCOVERY, MUTUAL MATCHES, PROFILES AND CHAT
   Uses the existing Supabase database and RLS policies.
===================================================== */

let discoveryCandidates = [];
let discoveryIndex = 0;
let discoveryUser = null;
let discoveryBusy = false;
let discoveryLoading = false;
let discoveryMatchedIds = new Set();
let discoveryMatchRecords = new Map();
let discoveryBlockedIds = new Set();
let activeChatChannel = null;
let activeChatMatchId = null;
let chatLoading = false;

const discovery$ = id => document.getElementById(id);

function discoveryMessage(message) {
  const element = discovery$("feedback");
  if (element) element.textContent = message;
}

function hideDiscoveryCard() {
  const card = discovery$("card");
  if (card) card.hidden = true;
}

function showDiscoveryCard() {
  const card = discovery$("card");
  if (card) card.hidden = false;
}

function normalizeCity(value) {
  return String(value || "").trim().toLowerCase();
}

function compatibleGender(preference, gender) {
  return preference === "any" || preference === gender;
}

/* =====================================================
   RELATIONSHIP GOALS
===================================================== */

function goalDatabaseValue(value) {
  const allowedGoals = [
    "marriage",
    "serious_relationship",
    "marriage_oriented_serious_relationship"
  ];

  if (!value || value === "all") return null;

  return allowedGoals.includes(value) ? value : null;
}

function relationshipGoalLabel(value) {
  const labels = {
    marriage: "Marriage",
    serious_relationship: "Long-term Serious Relationship",
    marriage_oriented_serious_relationship:
      "Marriage-Oriented Serious Relationship"
  };

  return labels[value] || "Not specified";
}

function safeText(value, fallback = "Not provided") {
  return String(value || "").trim() || fallback;
}

/* =====================================================
   SHARED DIALOG STYLES
===================================================== */

function addPairHiDialogStyles() {
  if (discovery$("pairhiDialogStyles")) return;

  const style = document.createElement("style");
  style.id = "pairhiDialogStyles";

  style.textContent = `
    .pairhi-dialog {
      width:min(94%,560px);
      max-width:560px;
      max-height:90vh;
      overflow:auto;
      border:1px solid #eadfe3;
      border-radius:18px;
      padding:0;
      color:#29232a;
      background:#fff;
    }

    .pairhi-dialog::backdrop {
      background:rgba(25,15,22,.68);
      backdrop-filter:blur(3px);
    }

    .pairhi-dialog-inner {
      padding:20px;
    }

    .pairhi-dialog-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:16px;
    }

    .pairhi-dialog-header h2 {
      margin:0;
      color:#8f3658;
      font-size:21px;
    }

    .pairhi-close {
      border:0;
      background:transparent;
      color:#766d73;
      font-size:27px;
      cursor:pointer;
      padding:4px 10px;
    }

    .pairhi-profile-photo {
      width:100%;
      max-height:330px;
      object-fit:cover;
      border-radius:14px;
      background:#f5dce6;
      margin-bottom:15px;
    }

    .pairhi-profile-detail {
      padding:11px 0;
      border-bottom:1px solid #f0e7eb;
      overflow-wrap:anywhere;
    }

    .pairhi-profile-detail strong {
      display:block;
      color:#8f3658;
      font-size:12px;
      margin-bottom:4px;
    }

    .pairhi-profile-detail span {
      display:block;
      color:#29232a;
      font-size:15px;
      white-space:pre-wrap;
    }

    .pairhi-action-button {
      border:0;
      border-radius:10px;
      padding:12px 17px;
      background:#8f3658;
      color:white;
      font-weight:600;
      cursor:pointer;
      min-height:43px;
    }

    .pairhi-secondary-button {
      border:1px solid #eadfe3;
      border-radius:10px;
      padding:11px 15px;
      background:#fff;
      color:#8f3658;
      font-weight:600;
      cursor:pointer;
      min-height:43px;
    }

    .pairhi-match-card {
      display:flex;
      align-items:center;
      gap:12px;
      padding:13px;
      margin-bottom:11px;
      border:1px solid #eadfe3;
      border-radius:13px;
      background:#fff;
    }

    .pairhi-match-avatar {
      display:block !important;
      flex:0 0 48px !important;
      width:48px !important;
      height:48px !important;
      min-width:48px !important;
      min-height:48px !important;
      max-width:48px !important;
      max-height:48px !important;
      aspect-ratio:1 / 1 !important;
      border-radius:50% !important;
      object-fit:cover !important;
      overflow:hidden !important;
      background:#f5dce6;
    }

    #pairhiMatches img.pairhi-match-avatar {
      display:block !important;
      flex:0 0 48px !important;
      width:48px !important;
      height:48px !important;
      min-width:48px !important;
      min-height:48px !important;
      max-width:48px !important;
      max-height:48px !important;
      aspect-ratio:1 / 1 !important;
      object-fit:cover !important;
      border-radius:50% !important;
    }

    .pairhi-match-details {
      flex:1;
      min-width:0;
    }

    .pairhi-match-details strong {
      display:block;
      color:#29232a;
      font-size:15px;
    }

    .pairhi-match-details small {
      display:block;
      color:#766d73;
      margin-top:4px;
    }

    .pairhi-match-actions {
      display:flex;
      flex-wrap:wrap;
      gap:7px;
      margin-top:9px;
    }

    .pairhi-match-actions button {
      font-size:12px;
      padding:8px 11px;
      min-height:35px;
    }

    .pairhi-chat-messages {
      height:min(48vh,390px);
      overflow-y:auto;
      padding:12px;
      background:#fbf7f4;
      border:1px solid #eadfe3;
      border-radius:12px;
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .pairhi-chat-bubble {
      max-width:82%;
      padding:10px 12px;
      border-radius:13px;
      overflow-wrap:anywhere;
      white-space:pre-wrap;
      font-size:14px;
    }

    .pairhi-chat-mine {
      align-self:flex-end;
      background:#8f3658;
      color:#fff;
      border-bottom-right-radius:3px;
    }

    .pairhi-chat-theirs {
      align-self:flex-start;
      background:#fff;
      color:#29232a;
      border:1px solid #eadfe3;
      border-bottom-left-radius:3px;
    }

    .pairhi-chat-time {
      display:block;
      font-size:10px;
      opacity:.75;
      margin-top:5px;
    }

    .pairhi-chat-form {
      display:flex;
      gap:8px;
      margin-top:12px;
    }

    .pairhi-chat-form textarea {
      flex:1;
      min-width:0;
      min-height:44px;
      max-height:110px;
      resize:vertical;
      border:1px solid #eadfe3;
      border-radius:10px;
      padding:11px;
      font:inherit;
    }

    .pairhi-chat-status {
      color:#766d73;
      font-size:12px;
      margin-top:9px;
      min-height:18px;
    }

    .pairhi-safety-actions {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:12px;
    }

    .pairhi-safety-button {
      border:1px solid #eadfe3;
      border-radius:9px;
      padding:9px 12px;
      min-height:38px;
      background:#fff;
      color:#8f3658;
      font-size:13px;
      font-weight:600;
      cursor:pointer;
    }

    .pairhi-danger-button {
      border-color:#d9a5b3;
      color:#9b263f;
    }

    .pairhi-report-field {
      margin:0 0 14px;
    }

    .pairhi-report-field label {
      display:block;
      margin-bottom:6px;
      font-size:14px;
      font-weight:600;
    }

    .pairhi-report-field select,
    .pairhi-report-field textarea {
      width:100%;
      box-sizing:border-box;
      border:1px solid #eadfe3;
      border-radius:9px;
      padding:11px;
      font:inherit;
      background:#fff;
      color:#29232a;
    }

    .pairhi-report-field textarea {
      min-height:100px;
      resize:vertical;
    }

    @media(max-width:420px) {
      .pairhi-dialog-inner {padding:15px}
      .pairhi-match-card {align-items:flex-start}
      .pairhi-match-actions {gap:5px}
    }
  `;

  document.head.appendChild(style);
}

/* =====================================================
   MEMBER SAFETY: BLOCKING AND REPORTING
===================================================== */

function createSafetyButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "pairhi-safety-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createReportDialog() {
  let dialog = discovery$("pairhiReportDialog");
  if (dialog) return dialog;

  addPairHiDialogStyles();

  dialog = document.createElement("dialog");
  dialog.id = "pairhiReportDialog";
  dialog.className = "pairhi-dialog";

  const inner = document.createElement("div");
  inner.className = "pairhi-dialog-inner";

  const header = document.createElement("div");
  header.className = "pairhi-dialog-header";

  const heading = document.createElement("h2");
  heading.textContent = "Report member";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "pairhi-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close report form");
  close.addEventListener("click", () => dialog.close());

  header.append(heading, close);

  const intro = document.createElement("p");
  intro.textContent =
    "Tell us what happened. Reports are private and will be reviewed by the PairHi team.";
  intro.style.cssText = "color:#766d73;font-size:13px;line-height:1.5";

  const form = document.createElement("form");
  form.id = "pairhiReportForm";

  const reasonWrap = document.createElement("div");
  reasonWrap.className = "pairhi-report-field";
  const reasonLabel = document.createElement("label");
  reasonLabel.htmlFor = "pairhiReportReason";
  reasonLabel.textContent = "Reason for reporting *";
  const reason = document.createElement("select");
  reason.id = "pairhiReportReason";
  reason.required = true;

  const reasonOptions = [
    ["", "Select a reason"],
    ["fake_profile", "Fake or misleading profile"],
    ["harassment", "Harassment or abusive behaviour"],
    ["inappropriate_content", "Inappropriate content"],
    ["scam_or_fraud", "Scam or fraud"],
    ["already_married", "Already married / relationship status misrepresented"],
    ["underage", "Underage member"],
    ["other", "Other concern"]
  ];
     reasonOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    reason.appendChild(option);
  });
  reasonWrap.append(reasonLabel, reason);

  const descriptionWrap = document.createElement("div");
  descriptionWrap.className = "pairhi-report-field";
  const descriptionLabel = document.createElement("label");
  descriptionLabel.htmlFor = "pairhiReportDescription";
  descriptionLabel.textContent = "Additional details (optional)";
  const description = document.createElement("textarea");
  description.id = "pairhiReportDescription";
  description.maxLength = 1000;
  description.placeholder = "Share any helpful details (up to 1,000 characters).";
  descriptionWrap.append(descriptionLabel, description);

  const status = document.createElement("div");
  status.id = "pairhiReportStatus";
  status.className = "pairhi-chat-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:9px;flex-wrap:wrap;margin-top:12px";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "pairhi-action-button";
  submit.textContent = "Submit report";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "pairhi-secondary-button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => dialog.close());

  actions.append(submit, cancel);
  form.append(reasonWrap, descriptionWrap, status, actions);
  inner.append(header, intro, form);
  dialog.appendChild(inner);
  document.body.appendChild(dialog);

  form.addEventListener("submit", submitPairHiReport);
  return dialog;
}

function openPairHiReport(targetUserId) {
  if (!discoveryUser) {
    discoveryMessage("Please log in before submitting a report.");
    return;
  }
  if (!targetUserId || targetUserId === discoveryUser.id) return;

  const dialog = createReportDialog();
  dialog.dataset.reportedUserId = targetUserId;
  const form = discovery$("pairhiReportForm");
  if (form) form.reset();
  const status = discovery$("pairhiReportStatus");
  if (status) status.textContent = "";
  if (!dialog.open) dialog.showModal();
}

async function submitPairHiReport(event) {
  event.preventDefault();

  const dialog = discovery$("pairhiReportDialog");
  const reason = discovery$("pairhiReportReason");
  const description = discovery$("pairhiReportDescription");
  const status = discovery$("pairhiReportStatus");
  const submit = discovery$("pairhiReportForm")?.querySelector('button[type="submit"]');
  const reportedUserId = dialog?.dataset.reportedUserId;

  if (!discoveryUser || !reportedUserId || !reason || !reason.value) {
    if (status) status.textContent = "Please select a report reason.";
    return;
  }

  if (submit) submit.disabled = true;
  if (status) status.textContent = "Submitting your report...";

  try {
    const { error } = await supabaseClient
      .from("pairhi_reports")
      .insert({
        reporter_id: discoveryUser.id,
        reported_user_id: reportedUserId,
        reason: reason.value,
        description: description?.value.trim() || null
      });

    if (error) throw error;

    if (status) status.textContent = "Thank you. Your report has been submitted for review.";
    window.setTimeout(() => {
      if (dialog?.open) dialog.close();
      discoveryMessage("Your report has been submitted privately to the PairHi team.");
    }, 900);
  } catch (error) {
    console.error("PairHi report submission error:", error);
    if (status) status.textContent = "Could not submit report: " + error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function blockPairHiMember(targetUserId, matchId = null) {
  if (!discoveryUser || !targetUserId || targetUserId === discoveryUser.id) return;

  const confirmed = window.confirm(
    "Block this member? They will disappear from your discovery and mutual matches, and you will not be able to message each other."
  );
  if (!confirmed) return;

  try {
    discoveryMessage("Blocking this member...");

    const { error } = await supabaseClient
      .from("pairhi_blocks")
      .insert({
        blocker_id: discoveryUser.id,
        blocked_id: targetUserId
      });

    if (error && error.code !== "23505") throw error;

    discoveryBlockedIds.add(targetUserId);

    if (matchId && activeChatMatchId === matchId) {
      const chatDialog = discovery$("pairhiChatDialog");
      if (chatDialog?.open) chatDialog.close();
      stopChatRealtime();
      activeChatMatchId = null;
    }

    const profileDialog = discovery$("pairhiProfileDialog");
    if (profileDialog?.open) profileDialog.close();

    discoveryMessage("Member blocked. Their profile and conversation are now hidden from you.");
    await loadDiscovery();
  } catch (error) {
    console.error("PairHi block error:", error);
    discoveryMessage("Could not block this member: " + error.message);
  }
}

/* =====================================================
   PROFILE DIALOG
===================================================== */

function createProfileDialog() {
  let dialog = discovery$("pairhiProfileDialog");

  if (dialog) return dialog;

  addPairHiDialogStyles();

  dialog = document.createElement("dialog");
  dialog.id = "pairhiProfileDialog";
  dialog.className = "pairhi-dialog";

  const inner = document.createElement("div");
  inner.className = "pairhi-dialog-inner";

  const header = document.createElement("div");
  header.className = "pairhi-dialog-header";

  const heading = document.createElement("h2");
  heading.textContent = "Member profile";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "pairhi-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close profile");
  close.addEventListener("click", () => dialog.close());

  header.append(heading, close);

  const content = document.createElement("div");
  content.id = "pairhiProfileContent";

  inner.append(header, content);
  dialog.appendChild(inner);
  document.body.appendChild(dialog);

  return dialog;
}

function addProfileDetail(container, label, value) {
  const detail = document.createElement("div");
  detail.className = "pairhi-profile-detail";

  const heading = document.createElement("strong");
  heading.textContent = label;

  const text = document.createElement("span");
  text.textContent = safeText(value);

  detail.append(heading, text);
  container.appendChild(detail);
}

async function openMatchedProfile(matchId) {
  const record = discoveryMatchRecords.get(matchId);

  if (!record || !record.profile) {
    discoveryMessage("This matched profile could not be loaded.");
    return;
  }

  const member = record.profile;
  const dialog = createProfileDialog();
  const content = discovery$("pairhiProfileContent");

  content.replaceChildren();

  const image = document.createElement("img");
  image.className = "pairhi-profile-photo";
  image.alt = "Member profile photograph";
  image.src = "";

  content.appendChild(image);

  if (member.photo_url) {
    const { data, error } = await supabaseClient.storage
      .from("profile-photos")
      .createSignedUrl(member.photo_url, 3600);

    if (!error && data && data.signedUrl) {
      image.src = data.signedUrl;
    } else {
      image.alt = "Profile photograph unavailable";
    }
  } else {
    image.alt = "No profile photograph available";
  }

  const name =
    safeText(member.display_name, "PairHi Member") +
    (member.age ? ", " + member.age : "");

  addProfileDetail(content, "Name and age", name);
  addProfileDetail(content, "City", member.city);
  addProfileDetail(content, "Gender", member.gender);

  addProfileDetail(
    content,
    "Relationship goal",
    relationshipGoalLabel(member.relationship_goal)
  );

  addProfileDetail(content, "Education", member.education);
  addProfileDetail(content, "Occupation", member.occupation);
  addProfileDetail(content, "Marital status", member.marital_status);
  addProfileDetail(content, "Interests", member.interests);
  addProfileDetail(content, "Lifestyle", member.lifestyle);
  addProfileDetail(content, "About", member.bio);

  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:10px;flex-wrap:wrap;margin-top:17px";

  const messageButton = document.createElement("button");
  messageButton.type = "button";
  messageButton.className = "pairhi-action-button";
  messageButton.textContent = "Start messaging";

  messageButton.addEventListener("click", () => {
    dialog.close();
    openPairHiChat(matchId);
  });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "pairhi-secondary-button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => dialog.close());

  actions.append(messageButton, closeButton);
  content.appendChild(actions);

  const safetyActions = document.createElement("div");
  safetyActions.className = "pairhi-safety-actions";
  safetyActions.append(
    createSafetyButton("Report member", "pairhi-safety-button", () => {
      openPairHiReport(member.id);
    }),
    createSafetyButton("Block member", "pairhi-safety-button pairhi-danger-button", () => {
      blockPairHiMember(member.id, matchId);
    })
  );
  content.appendChild(safetyActions);

  if (!dialog.open) dialog.showModal();
}

/* =====================================================
   CHAT DIALOG
===================================================== */

function createChatDialog() {
  let dialog = discovery$("pairhiChatDialog");

  if (dialog) return dialog;

  addPairHiDialogStyles();

  dialog = document.createElement("dialog");
  dialog.id = "pairhiChatDialog";
  dialog.className = "pairhi-dialog";

  const inner = document.createElement("div");
  inner.className = "pairhi-dialog-inner";

  const header = document.createElement("div");
  header.className = "pairhi-dialog-header";

  const heading = document.createElement("h2");
  heading.id = "pairhiChatHeading";
  heading.textContent = "Messages";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "pairhi-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close chat");

  close.addEventListener("click", () => dialog.close());

  header.append(heading, close);

  const messages = document.createElement("div");
  messages.id = "pairhiChatMessages";
  messages.className = "pairhi-chat-messages";

  const status = document.createElement("div");
  status.id = "pairhiChatStatus";
  status.className = "pairhi-chat-status";
  status.textContent = "Messages are private to this mutual match.";

  const form = document.createElement("form");
  form.id = "pairhiChatForm";
  form.className = "pairhi-chat-form";

  const input = document.createElement("textarea");
  input.id = "pairhiChatInput";
  input.maxLength = 2000;
  input.placeholder = "Write a respectful message...";
  input.required = true;
  input.setAttribute("aria-label", "Your message");

  const send = document.createElement("button");
  send.type = "submit";
  send.className = "pairhi-action-button";
  send.textContent = "Send";

  form.append(input, send);
  inner.append(header, messages, status, form);
  dialog.appendChild(inner);
  document.body.appendChild(dialog);

  form.addEventListener("submit", sendPairHiMessage);

  dialog.addEventListener("close", () => {
    stopChatRealtime();
    activeChatMatchId = null;
  });

  return dialog;
}

function stopChatRealtime() {
  if (activeChatChannel) {
    supabaseClient.removeChannel(activeChatChannel);
    activeChatChannel = null;
  }
}

function formatMessageTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderChatMessages(rows) {
  const container = discovery$("pairhiChatMessages");

  if (!container) return;

  container.replaceChildren();

  if (!rows || rows.length === 0) {
    const empty = document.createElement("p");
    empty.textContent =
      "This is the beginning of your conversation. Say hello!";
    empty.style.cssText =
      "color:#766d73;text-align:center;font-size:13px;margin:auto";

    container.appendChild(empty);
    return;
  }

  rows.forEach(message => {
    const bubble = document.createElement("div");

    bubble.className =
      "pairhi-chat-bubble " +
      (
        message.sender_id === discoveryUser.id
          ? "pairhi-chat-mine"
          : "pairhi-chat-theirs"
      );

    const content = document.createElement("div");
    content.textContent = message.content;

    const time = document.createElement("small");
    time.className = "pairhi-chat-time";
    time.textContent = formatMessageTime(message.created_at);

    bubble.append(content, time);
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

async function loadPairHiMessages(matchId) {
  if (!discoveryUser) return;

  const status = discovery$("pairhiChatStatus");

  if (status) status.textContent = "Loading conversation...";

  const { data, error } = await supabaseClient
    .from("messages")
    .select("id,match_id,sender_id,content,created_at")
    .eq("match_id", matchId)
       .order("created_at", { ascending: true });

  if (error) throw error;

  renderChatMessages(data || []);

  if (status) {
    status.textContent =
      "Private conversation · Only the two matched members can read these messages.";
  }
}

async function openPairHiChat(matchId) {
  const record = discoveryMatchRecords.get(matchId);

  if (!record || !record.match || !discoveryUser) {
    discoveryMessage("You can only message an existing mutual match.");
    return;
  }

  const dialog = createChatDialog();

  stopChatRealtime();

  activeChatMatchId = matchId;

  const heading = discovery$("pairhiChatHeading");

  if (heading) {
    heading.textContent =
      "Chat with " +
      safeText(record.profile.display_name, "PairHi Member");
  }

  const input = discovery$("pairhiChatInput");
  if (input) input.value = "";

  const messages = discovery$("pairhiChatMessages");
  if (messages) messages.replaceChildren();

  if (!dialog.open) dialog.showModal();

  try {
    await loadPairHiMessages(matchId);

    activeChatChannel = supabaseClient
      .channel("pairhi-chat-" + matchId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "match_id=eq." + matchId
        },
        () => {
          if (activeChatMatchId === matchId) {
            loadPairHiMessages(matchId).catch(error => {
              console.error("PairHi live message error:", error);
            });
          }
        }
      )
      .subscribe();

  } catch (error) {
    console.error("PairHi chat loading error:", error);

    const status = discovery$("pairhiChatStatus");

    if (status) {
      status.textContent =
        "Could not load messages: " + error.message;
    }
  }
}

async function sendPairHiMessage(event) {
  event.preventDefault();

  if (chatLoading) return;

  const matchId = activeChatMatchId;
  const input = discovery$("pairhiChatInput");
  const form = discovery$("pairhiChatForm");
  const status = discovery$("pairhiChatStatus");

  if (!matchId || !discoveryUser || !input || !form) {
    return;
  }

  const content = input.value.trim();

  if (!content) return;

  if (content.length > 2000) {
    if (status) {
      status.textContent =
        "Please keep your message under 2,000 characters.";
    }
    return;
  }

  chatLoading = true;

  const sendButton = form.querySelector('button[type="submit"]');

  if (sendButton) sendButton.disabled = true;

  if (status) status.textContent = "Sending message...";

  try {
    const { error } = await supabaseClient
      .from("messages")
      .insert({
        match_id: matchId,
        sender_id: discoveryUser.id,
        content: content
      });

    if (error) throw error;

    input.value = "";

    await loadPairHiMessages(matchId);

  } catch (error) {
    console.error("PairHi message sending error:", error);

    if (status) {
      status.textContent =
        "Message could not be sent: " + error.message;
    }

  } finally {
    chatLoading = false;

    if (sendButton) sendButton.disabled = false;

    if (input) input.focus();
  }
}

/* =====================================================
   MATCH DISPLAY
===================================================== */

function createMatchSection() {
  let section = discovery$("pairhiMatches");

  if (section) return section;

  section = document.createElement("section");
  section.id = "pairhiMatches";

  section.style.cssText = [
    "margin:20px auto",
    "padding:18px",
    "max-width:900px",
    "background:#fff",
    "border:1px solid #eadfe3",
    "border-radius:16px",
    "display:none"
  ].join(";");

  const discoverSection = discovery$("discover");

  if (discoverSection) {
    const feedback = discovery$("feedback");

    if (feedback && feedback.parentNode) {
      feedback.parentNode.insertBefore(section, feedback);
    } else {
      discoverSection.appendChild(section);
    }
  }

  return section;
}

function createMatchButton(label, action, matchId, primary) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.dataset.matchAction = action;
  button.dataset.matchId = matchId;

  button.className = primary
    ? "pairhi-action-button"
    : "pairhi-secondary-button";

  return button;
}

function showMatchSection(profiles) {
  const section = createMatchSection();

  if (!section) return;

  section.replaceChildren();

  if (!profiles || profiles.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  const heading = document.createElement("h2");
  heading.textContent = "♥ Your mutual matches";
  heading.style.cssText =
    "color:#8f3658;margin:0 0 10px;font-size:22px";

  const description = document.createElement("p");
  description.textContent =
    "Open a profile or start a private conversation with your match.";
  description.style.cssText =
    "color:#766d73;margin:0 0 15px;font-size:14px";

  section.append(heading, description);

  profiles.forEach(member => {
    const matchId = member.matchId;

    const card = document.createElement("div");
    card.className = "pairhi-match-card";

    const avatar = document.createElement("div");
    avatar.className = "pairhi-match-avatar";

    avatar.style.cssText =
      "display:flex;align-items:center;justify-content:center;" +
      "font-size:20px;font-weight:bold;color:#8f3658";

    avatar.textContent =
      safeText(member.display_name, "P").charAt(0).toUpperCase();

    const details = document.createElement("div");
    details.className = "pairhi-match-details";

    const name = document.createElement("strong");

    name.textContent =
      safeText(member.display_name, "PairHi Member") +
      (member.age ? ", " + member.age : "");

    const city = document.createElement("small");
    city.textContent = safeText(member.city, "City not provided");

    const actions = document.createElement("div");
    actions.className = "pairhi-match-actions";

    actions.append(
      createMatchButton("View profile", "profile", matchId, false),
      createMatchButton("Message", "chat", matchId, true)
    );

    details.append(name, city, actions);
    card.append(avatar, details);
    section.appendChild(card);

    if (member.photo_url) {
      supabaseClient.storage
        .from("profile-photos")
        .createSignedUrl(member.photo_url, 3600)
        .then(({ data, error }) => {
          if (!error && data && data.signedUrl) {
            const image = document.createElement("img");

            image.className = "pairhi-match-avatar";
            image.src = data.signedUrl;
            image.alt = "Matched member";
            image.loading = "lazy";

            image.style.cssText =
              "display:block !important;flex:0 0 48px !important;" +
              "width:48px !important;height:48px !important;" +
              "min-width:48px !important;min-height:48px !important;" +
              "max-width:48px !important;max-height:48px !important;" +
              "aspect-ratio:1/1 !important;object-fit:cover !important;" +
              "border-radius:50% !important;overflow:hidden !important;";

            avatar.replaceWith(image);
          }
        })
        .catch(error => {
          console.warn("Match photo error:", error);
        });
    }
  });
}

/* Match button actions use event delegation. */
document.addEventListener("click", event => {
  const button = event.target.closest("[data-match-action]");

  if (!button) return;

  const matchId = button.dataset.matchId;
  const action = button.dataset.matchAction;

  if (action === "profile") {
    openMatchedProfile(matchId);
  } else if (action === "chat") {
    openPairHiChat(matchId);
  }
});

/* =====================================================
   LOAD MY MUTUAL MATCHES
===================================================== */

async function loadMyMatches(userId) {
  const { data: matches, error: matchError } =
    await supabaseClient
      .from("matches")
      .select("id,user1_id,user2_id,created_at")
      .or(
        "user1_id.eq." + userId +
        ",user2_id.eq." + userId
      );

  if (matchError) throw matchError;

  const matchRows = matches || [];

  discoveryMatchedIds = new Set(
    matchRows.map(match =>
      match.user1_id === userId
        ? match.user2_id
        : match.user1_id
    )
  );

  discoveryMatchRecords = new Map();

  if (matchRows.length === 0) {
    showMatchSection([]);
    return [];
  }

  const matchedIds = Array.from(discoveryMatchedIds);

  const { data: profiles, error: profileError } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .in("id", matchedIds);

  if (profileError) throw profileError;

  const profileMap = new Map(
    (profiles || []).map(profile => [profile.id, profile])
  );

  const displayProfiles = [];

  matchRows.forEach(match => {
    const otherId =
      match.user1_id === userId
        ? match.user2_id
        : match.user1_id;

    const profile = profileMap.get(otherId);

    if (!profile) return;

    discoveryMatchRecords.set(match.id, {
      match: match,
      profile: profile
    });

    displayProfiles.push({
      ...profile,
      matchId: match.id
    });
  });

  showMatchSection(displayProfiles);

  return matchRows;
}

/* =====================================================
   LOAD DISCOVERY
===================================================== */

async function loadDiscovery() {
  if (discoveryLoading) return;

  discoveryLoading = true;
  discoveryCandidates = [];
  discoveryIndex = 0;

  hideDiscoveryCard();

  try {
    discoveryMessage("Loading your PairHi account...");

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      discoveryUser = null;
      discoveryMatchedIds = new Set();
      discoveryMatchRecords = new Map();
      discoveryBlockedIds = new Set();
      showMatchSection([]);

      discoveryMessage(
        "Please log in to discover approved PairHi members."
      );

      return;
    }

    const user = sessionData.session.user;
    discoveryUser = user;

    const { data: myProfile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!myProfile) {
      discoveryMessage(
        "Please complete your PairHi profile first."
      );
      return;
    }

    if (myProfile.verification_status !== "approved") {
      discoveryMessage(
        "Your profile is awaiting administrator approval. " +
        "Discovery will become available after approval."
      );
      return;
    }

    await loadMyMatches(user.id);

    const { data: blockedRows, error: blockedError } =
      await supabaseClient.rpc("pairhi_get_blocked_user_ids");
         if (blockedError) throw blockedError;

    discoveryBlockedIds = new Set(
      (blockedRows || []).map(row => row.blocked_user_id)
    );

    if (
      !myProfile.age ||
      !myProfile.gender ||
      !myProfile.preferred_gender
    ) {
      discoveryMessage(
        "Please complete your age and gender preferences in My Profile."
      );
      return;
    }

    const cityToUse =
      myProfile.preferred_city || myProfile.city;

    if (!cityToUse) {
      discoveryMessage(
        "Please add your city or preferred city in My Profile."
      );
      return;
    }

    const { data: members, error: membersError } =
      await supabaseClient
        .from("profiles")
        .select(
          "id,display_name,age,gender,preferred_gender," +
          "min_age_preference,max_age_preference,city," +
          "bio,relationship_goal,photo_url," +
          "education,occupation,marital_status,interests,lifestyle"
        )
        .eq("verification_status", "approved")
        .neq("id", user.id);

    if (membersError) throw membersError;

    const { data: likes, error: likesError } =
      await supabaseClient
        .from("likes")
        .select("liked_user_id")
        .eq("liker_id", user.id);

    if (likesError) throw likesError;

    const { data: passes, error: passesError } =
      await supabaseClient
        .from("passes")
        .select("passed_user_id")
        .eq("passer_id", user.id);

    if (passesError) throw passesError;

    const alreadyLiked = new Set(
      (likes || []).map(item => item.liked_user_id)
    );

    const alreadyPassed = new Set(
      (passes || []).map(item => item.passed_user_id)
    );

    const intentFilter = discovery$("intentFilter");

    const selectedGoal = intentFilter
      ? goalDatabaseValue(intentFilter.value)
      : null;

    const targetCity = normalizeCity(cityToUse);

    discoveryCandidates = (members || []).filter(member => {
      if (!member.age || !member.gender) return false;

      if (alreadyLiked.has(member.id)) return false;
      if (alreadyPassed.has(member.id)) return false;
      if (discoveryMatchedIds.has(member.id)) return false;
      if (discoveryBlockedIds.has(member.id)) return false;

      if (
        member.age < (myProfile.min_age_preference || 18) ||
        member.age > (myProfile.max_age_preference || 100)
      ) {
        return false;
      }

      if (
        !compatibleGender(
          myProfile.preferred_gender,
          member.gender
        )
      ) {
        return false;
      }

      if (
        !compatibleGender(
          member.preferred_gender,
          myProfile.gender
        )
      ) {
        return false;
      }

      if (
        myProfile.age < (member.min_age_preference || 18) ||
        myProfile.age > (member.max_age_preference || 100)
      ) {
        return false;
      }

      if (normalizeCity(member.city) !== targetCity) {
        return false;
      }

      if (
        selectedGoal &&
        member.relationship_goal !== selectedGoal
      ) {
        return false;
      }

      return true;
    });

    if (discoveryCandidates.length === 0) {
      hideDiscoveryCard();

      if (discoveryMatchedIds.size > 0) {
        discoveryMessage(
          "Your mutual matches are shown above. " +
          "There are no new compatible profiles to discover right now."
        );
      } else {
        discoveryMessage(
          "No compatible approved members are available in " +
          cityToUse +
          " yet."
        );
      }

      return;
    }

    discoveryMessage(
      discoveryCandidates.length +
      " compatible approved member(s) found."
    );

    await renderRealCandidate();

  } catch (error) {
    console.error("PairHi discovery error:", error);

    discoveryMessage(
      "Discovery error: " + error.message
    );

  } finally {
    discoveryLoading = false;
  }
}

/* =====================================================
   RENDER DISCOVERY PROFILE
===================================================== */

async function renderRealCandidate() {
  if (discoveryIndex >= discoveryCandidates.length) {
    hideDiscoveryCard();

    discoveryMessage(
      "You've viewed all currently available compatible profiles. " +
      "Your mutual matches are shown above."
    );

    return;
  }

  const member = discoveryCandidates[discoveryIndex];

  const card = discovery$("card");
  const photo = discovery$("photo");

  if (!card || !photo) {
    discoveryMessage(
      "The discovery card is missing from index.html."
    );
    return;
  }

  showDiscoveryCard();

  const personName = discovery$("personName");
  const personLocation = discovery$("personLocation");
  const personIntent = discovery$("personIntent");
  const personBio = discovery$("personBio");
  const personTags = discovery$("personTags");
  const compatScore = discovery$("compatScore");
  const photoNumber = discovery$("photoNumber");

  if (personName) {
    personName.textContent =
      (member.display_name || "PairHi Member") +
      ", " + member.age;
  }

  if (personLocation) {
    personLocation.textContent =
      (member.city || "") + " · India";
  }

  if (personIntent) {
    personIntent.textContent =
      relationshipGoalLabel(member.relationship_goal);
  }

  if (personBio) {
    personBio.textContent =
      member.bio || "This member has not added a bio yet.";
  }

  if (personTags) personTags.replaceChildren();

  if (compatScore) {
    compatScore.textContent = "Preferences compatible";
  }

  if (photoNumber) {
    photoNumber.textContent =
      (discoveryIndex + 1) +
      " / " +
      discoveryCandidates.length;
  }

  const badge = photo.querySelector(".verified");

  if (badge) badge.textContent = "✓ Approved member";

  photo.style.background =
    "linear-gradient(140deg,#d8a6b8,#92566b)";

  const oldImage = photo.querySelector("img");

  if (oldImage) oldImage.remove();

  if (member.photo_url) {
    try {
      const { data, error } = await supabaseClient.storage
        .from("profile-photos")
        .createSignedUrl(member.photo_url, 3600);

      if (!error && data && data.signedUrl) {
        const image = document.createElement("img");

        image.src = data.signedUrl;
        image.alt = "Approved member profile photograph";
        image.loading = "lazy";

        image.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;" +
          "object-fit:cover;border-radius:inherit;z-index:1";

        if (badge) badge.style.zIndex = "2";

        if (photoNumber) photoNumber.style.zIndex = "2";

        photo.appendChild(image);
      }
    } catch (photoError) {
      console.warn("Profile photo error:", photoError);
    }
  }

  const cardActions = card.querySelector(".actions");
  if (cardActions) {
    const oldSafetyActions = discovery$("pairhiDiscoverySafetyActions");
    if (oldSafetyActions) oldSafetyActions.remove();

    const safetyActions = document.createElement("div");
    safetyActions.id = "pairhiDiscoverySafetyActions";
    safetyActions.className = "pairhi-safety-actions";
    safetyActions.style.cssText = "justify-content:center;margin-top:10px";
    safetyActions.append(
      createSafetyButton("Report profile", "pairhi-safety-button", () => {
        openPairHiReport(member.id);
      }),
      createSafetyButton("Block profile", "pairhi-safety-button pairhi-danger-button", () => {
        blockPairHiMember(member.id);
      })
    );
    cardActions.insertAdjacentElement("afterend", safetyActions);
  }

  discoveryMessage(
    "Review this approved member and choose Interested or Pass. You can also report or block a profile."
  );
}

/* =====================================================
   SAVE INTEREST OR PASS
===================================================== */

async function saveDiscoveryAction(action) {
  if (discoveryBusy) return;

  const member = discoveryCandidates[discoveryIndex];

  if (!member || !discoveryUser) {
    discoveryMessage("No member is currently selected.");
    return;
  }

  const likeButton = discovery$("likeBtn");
  const passButton = discovery$("skipBtn");

  discoveryBusy = true;

  if (likeButton) likeButton.disabled = true;
  if (passButton) passButton.disabled = true;

  try {
    if (action === "like") {
      const { error } = await supabaseClient
        .from("likes")
        .insert({
          liker_id: discoveryUser.id,
          liked_user_id: member.id
        });

      if (error) throw error;

      await loadMyMatches(discoveryUser.id);

      if (discoveryMatchedIds.has(member.id)) {
        discoveryMessage(
          "♥ It's a mutual match! You can now open the profile " +
          "or start messaging from Your mutual matches."
        );
      } else {
        discoveryMessage(
          "Your interest has been saved. If this member also likes you, " +
          "a mutual match will appear above."
        );
      }

    } else {
      const { error } = await supabaseClient
        .from("passes")
        .insert({
          passer_id: discoveryUser.id,
          passed_user_id: member.id
        });

      if (error) throw error;

      discoveryMessage(
        "Pass saved. This profile will not appear in your discovery again."
      );
    }

    discoveryIndex++;

    await renderRealCandidate();

  } catch (error) {
    console.error("PairHi action error:", error);

    discoveryMessage(
      "Could not save your decision: " + error.message
    );

  } finally {
    discoveryBusy = false;

    if (likeButton) likeButton.disabled = false;
    if (passButton) passButton.disabled = false;
  }
}

/* =====================================================
   BUTTON EVENTS
===================================================== */

if (discovery$("likeBtn")) {
  discovery$("likeBtn").addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveDiscoveryAction("like");
    },
    true
  );
}

if (discovery$("skipBtn")) {
  discovery$("skipBtn").addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveDiscoveryAction("pass");
    },
    true
  );
}

if (discovery$("intentFilter")) {
  discovery$("intentFilter").addEventListener(
    "change",
    () => loadDiscovery()
  );
}

/* =====================================================
   UPDATE DISCOVERY WORDING
===================================================== */

const discoveryIntro =
  document.querySelector("#discover .section-heading p");

if (discoveryIntro) {
  discoveryIntro.textContent =
    "Discover real members whose preferences are compatible with yours.";
}

const discoveryHeroNote =
  document.querySelector(".hero .micro");

if (discoveryHeroNote) {
  discoveryHeroNote.textContent =
    "Live member discovery · Approved profiles only";
}

const discoveryFooter =
  document.querySelector("footer span");

if (discoveryFooter) {
  discoveryFooter.textContent =
    "Member profiles are subject to verification";
}

/* =====================================================
   AUTHENTICATION LISTENER
===================================================== */

supabaseClient.auth.onAuthStateChange(() => {
  stopChatRealtime();

  window.setTimeout(() => {
    loadDiscovery();
  }, 0);
});

/* Initial discovery load */
loadDiscovery();
