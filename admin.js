
const SUPABASE_URL = "https://nckkelnaxivmynmsktoa.supabase.co";
const SUPABASE_KEY = "sb_publishable_xlqXiXGxnQ5CXfSKr5DpyQ_WPMIgibr";

const adminClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const messageElement = document.getElementById("adminMessage");

const loadButton = document.getElementById("loadProfilesBtn");
const loadReportsButton = document.getElementById("loadReportsBtn");
const logoutButton = document.getElementById("adminLogoutBtn");

const membersPanel = document.getElementById("membersPanel");
const profilesList = document.getElementById("profilesList");

const reportsPanel = document.getElementById("reportsPanel");
const reportsList = document.getElementById("reportsList");

let adminVerified = false;

function showMessage(message) {
  messageElement.textContent = message;
}

function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);
  return element;
}

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not provided"
    : String(value);
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString();
}

function goalLabel(value) {
  const goals = {
    marriage: "Marriage",
    serious_relationship: "Serious relationship",
    marriage_oriented_serious_relationship:
      "Marriage-oriented serious relationship"
  };

  return goals[value] || displayValue(value);
}

function createActionButton(label, className, callback) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.className = className;

  button.addEventListener("click", callback);

  return button;
}

function reasonLabel(value) {
  const reasons = {
    fake_profile: "Fake profile",
    harassment: "Harassment",
    inappropriate_content: "Inappropriate content",
    scam_or_fraud: "Scam or fraud",
    already_married: "Already married",
    underage: "Underage member",
    other: "Other"
  };

  return reasons[value] || displayValue(value);
}

function reportStatusLabel(value) {
  const statuses = {
    pending: "Pending",
    under_review: "Under Review",
    resolved: "Resolved",
    dismissed: "Dismissed"
  };

  return statuses[value] || displayValue(value);
}

/* =====================================================
   MEMBER PROFILE MANAGEMENT
===================================================== */

async function loadProfiles() {
  loadButton.disabled = true;

  profilesList.replaceChildren();

  addText(
    profilesList,
    "p",
    "Loading member profiles..."
  );

  try {
    const { data, error } = await adminClient.rpc(
      "pairhi_admin_list_profiles"
    );

    if (error) throw error;

    adminVerified = true;

    profilesList.replaceChildren();
    membersPanel.hidden = false;

    if (!data || data.length === 0) {
      addText(
        profilesList,
        "p",
        "No member profiles found."
      );

      showMessage(
        "Administrator access verified. No profiles found."
      );

      return true;
    }

    showMessage(
      "Administrator access verified. " +
      data.length +
      " profile(s) found."
    );

    data.forEach(profile => {
      const card = document.createElement("article");
      card.className = "profile";

      addText(card, "h3", displayValue(profile.display_name));

      addText(
        card,
        "p",
        "Age: " + displayValue(profile.age)
      );

      addText(
        card,
        "p",
        "Gender: " + displayValue(profile.gender)
      );

      addText(
        card,
        "p",
        "City: " + displayValue(profile.city)
      );

      addText(
        card,
        "p",
        "Relationship goal: " +
        goalLabel(profile.relationship_goal)
      );

      addText(
        card,
        "p",
        "Registered: " + formatDate(profile.created_at)
      );

      addText(
        card,
        "span",
        "Status: " + displayValue(profile.verification_status),
        "status"
      );

      const actions = document.createElement("div");

      if (profile.verification_status !== "approved") {
        actions.appendChild(
          createActionButton("Approve", "approve", () =>
            updateStatus(profile.id, "approved")
          )
        );
      }

      if (profile.verification_status !== "rejected") {
        actions.appendChild(
          createActionButton("Reject", "reject", () =>
            updateStatus(profile.id, "rejected")
          )
        );
      }

      if (profile.verification_status !== "pending") {
        actions.appendChild(
          createActionButton("Set pending", "secondary", () =>
            updateStatus(profile.id, "pending")
          )
        );
      }

      card.appendChild(actions);
      profilesList.appendChild(card);
    });

    return true;

  } catch (error) {
    profilesList.replaceChildren();

    membersPanel.hidden = true;

    adminVerified = false;

    showMessage(
      "Could not load profiles: " + error.message
    );

    console.error("PairHi admin loading error:", error);

    return false;

  } finally {
    loadButton.disabled = false;
  }
}

async function updateStatus(profileId, newStatus) {
  const confirmed = window.confirm(
    "Are you sure you want to change this member's status to " +
    newStatus +
    "?"
  );

  if (!confirmed) return;

  try {
    showMessage("Updating member verification status...");

    const { data, error } = await adminClient.rpc(
      "pairhi_admin_update_status",
      {
        p_profile_id: profileId,
        p_new_status: newStatus
      }
    );

    if (error) throw error;

    if (data !== true) {
      throw new Error("The status update was not confirmed.");
    }

    showMessage("Member status updated successfully.");

    await loadProfiles();

  } catch (error) {
    showMessage("Status update error: " + error.message);

    console.error("PairHi admin update error:", error);
  }
}

/* =====================================================
   SAFETY REPORT MANAGEMENT
===================================================== */

async function loadReports() {
  if (!adminVerified) {
    showMessage("Administrator access has not been verified.");
    return;
  }

  loadReportsButton.disabled = true;

  reportsList.replaceChildren();

  addText(
    reportsList,
    "p",
    "Loading safety reports..."
  );

  reportsPanel.hidden = false;

  try {
    const { data, error } = await adminClient.rpc(
      "pairhi_admin_list_reports"
    );

    if (error) throw error;

    reportsList.replaceChildren();

    if (!data || data.length === 0) {
      addText(
        reportsList,
        "p",
        "No safety reports have been submitted."
      );

      showMessage("Safety reports loaded. No reports found.");

      return;
    }

    showMessage(
      data.length + " safety report(s) loaded successfully."
    );

    data.forEach(report => {
      const card = document.createElement("article");
      card.className = "report";

      addText(
        card,
        "h3",
        "Report: " + reasonLabel(report.reason)
      );

      addText(
        card,
        "p",
        "Reporter: " + displayValue(report.reporter_name)
      );

      addText(
        card,
        "p",
        "Reporter city: " + displayValue(report.reporter_city)
      );

      addText(
        card,
        "p",
        "Reported member: " + displayValue(report.reported_user_name)
      );

      addText(
        card,
        "p",
        "Reported member city: " +
        displayValue(report.reported_user_city)
      );

      addText(
        card,
        "p",
        "Submitted: " + formatDate(report.created_at)
      );

      addText(
        card,
        "p",
        "Report description: " + displayValue(report.description)
      );

      addText(
        card,
        "p",
        "Current status: " + reportStatusLabel(report.status),
        "status"
      );

      if (report.reviewed_at) {
        addText(
          card,
          "p",
          "Last reviewed: " + formatDate(report.reviewed_at)
        );
      }

      const statusLabel = document.createElement("label");
      statusLabel.className = "field-label";
      statusLabel.textContent = "Update report status";

      const statusSelect = document.createElement("select");

      const statusOptions = [
        { value: "under_review", label: "Under Review" },
        { value: "resolved", label: "Resolved" },
        { value: "dismissed", label: "Dismissed" }
      ];

      statusOptions.forEach(option => {
        const optionElement = document.createElement("option");

        optionElement.value = option.value;
        optionElement.textContent = option.label;

        statusSelect.appendChild(optionElement);
      });

      if (
        ["under_review", "resolved", "dismissed"].includes(report.status)
      ) {
        statusSelect.value = report.status;
      } else {
        statusSelect.value = "under_review";
      }

      statusLabel.appendChild(statusSelect);
      card.appendChild(statusLabel);

      const notesLabel = document.createElement("label");
      notesLabel.className = "field-label";
      notesLabel.textContent = "Private administrator notes";

      const notesInput = document.createElement("textarea");

      notesInput.value = report.admin_notes || "";
      notesInput.placeholder =
        "Write internal notes about your review...";

      notesLabel.appendChild(notesInput);
      card.appendChild(notesLabel);

      const actions = document.createElement("div");
      actions.className = "report-actions";

      const saveButton = createActionButton(
        "Save report changes",
        "primary",
        async () => {
          await updateReport(
            report.id,
            statusSelect.value,
            notesInput.value,
            saveButton
          );
        }
      );

      actions.appendChild(saveButton);
      card.appendChild(actions);

      reportsList.appendChild(card);
    });

  } catch (error) {
    reportsList.replaceChildren();

    addText(
      reportsList,
      "p",
      "Could not load safety reports: " + error.message
    );

    showMessage(
      "Report loading error: " + error.message
    );

    console.error("PairHi report loading error:", error);

  } finally {
    loadReportsButton.disabled = false;
  }
}

async function updateReport(
  reportId,
  newStatus,
  adminNotes,
  saveButton
) {
  const confirmed = window.confirm(
    "Save these changes to this safety report?"
  );

  if (!confirmed) return;

  saveButton.disabled = true;

  try {
    showMessage("Saving report changes...");

    const { data, error } = await adminClient.rpc(
      "pairhi_admin_update_report",
      {
        p_report_id: reportId,
        p_new_status: newStatus,
        p_admin_notes: adminNotes.trim() || null
      }
    );

    if (error) throw error;

    if (data !== true) {
      throw new Error("The report update was not confirmed.");
    }

    showMessage(
      "Report updated successfully. Refreshing reports..."
    );

    await loadReports();

  } catch (error) {
    saveButton.disabled = false;

    showMessage(
      "Could not update report: " + error.message
    );

    console.error("PairHi report update error:", error);
  }
}

/* =====================================================
   ADMIN LOGIN AND LOGOUT
===================================================== */

async function initializeAdmin() {
  try {
    showMessage("Checking your PairHi login...");

    const { data, error } = await adminClient.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      showMessage(
        "You are not logged in. First log in to PairHi using your administrator account."
      );

      loadButton.hidden = true;
      loadReportsButton.hidden = true;
      logoutButton.hidden = true;

      return;
    }

    const { data: userData, error: userError } =
      await adminClient.auth.getUser();

    if (userError) throw userError;

    showMessage(
      "Checking administrator permissions for " +
      (userData.user.email || "your account") +
      "..."
    );

    logoutButton.hidden = false;

    const verified = await loadProfiles();

    if (verified) {
      loadButton.hidden = false;
      loadReportsButton.hidden = false;
    } else {
      loadButton.hidden = false;
      loadReportsButton.hidden = true;
    }

  } catch (error) {
    showMessage(
      "Administrator access check failed: " + error.message
    );

    membersPanel.hidden = true;
    reportsPanel.hidden = true;

    console.error("PairHi admin access error:", error);
  }
}

/* =====================================================
   BUTTON EVENTS
===================================================== */

loadButton.addEventListener("click", async () => {
  const verified = await loadProfiles();

  if (verified) {
    loadReportsButton.hidden = false;
  }
});

loadReportsButton.addEventListener("click", loadReports);

logoutButton.addEventListener("click", async () => {
  try {
    const { error } = await adminClient.auth.signOut();

    if (error) throw error;

    adminVerified = false;

    membersPanel.hidden = true;
    reportsPanel.hidden = true;

    loadButton.hidden = true;
    loadReportsButton.hidden = true;
    logoutButton.hidden = true;

    profilesList.replaceChildren();
    reportsList.replaceChildren();

    showMessage("You have logged out successfully.");

  } catch (error) {
    showMessage("Logout error: " + error.message);
  }
});

/* Start the dashboard */

initializeAdmin();
