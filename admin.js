
const SUPABASE_URL = "https://nckkelnaxivmynmsktoa.supabase.co";
const SUPABASE_KEY = "sb_publishable_xlqXiXGxnQ5CXfSKr5DpyQ_WPMIgibr";

const adminClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const messageElement = document.getElementById("adminMessage");
const loadButton = document.getElementById("loadProfilesBtn");
const logoutButton = document.getElementById("adminLogoutBtn");
const membersPanel = document.getElementById("membersPanel");
const profilesList = document.getElementById("profilesList");

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

function goalLabel(value) {
  const goals = {
    marriage: "Marriage",
    serious_relationship: "Serious relationship",
    friendship: "Friendship"
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

async function loadProfiles() {
  loadButton.disabled = true;
  profilesList.replaceChildren();
  addText(profilesList, "p", "Loading member profiles...");

  try {
    const { data, error } = await adminClient.rpc(
      "pairhi_admin_list_profiles"
    );

    if (error) throw error;

    profilesList.replaceChildren();
    membersPanel.hidden = false;

    if (!data || data.length === 0) {
      addText(profilesList, "p", "No member profiles found.");
      showMessage("Administrator access verified. No profiles found.");
      return;
    }

    showMessage(
      "Administrator access verified. " +
      data.length +
      " profile(s) found."
    );

    data.forEach(profile => {
      const card = document.createElement("article");
      card.className = "profile";

      addText(
        card,
        "h3",
        displayValue(profile.display_name)
      );

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
        "Relationship goal: " + goalLabel(profile.relationship_goal)
      );

      addText(
        card,
        "p",
        "Registered: " +
        (
          profile.created_at
            ? new Date(profile.created_at).toLocaleString()
            : "Not available"
        )
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

  } catch (error) {
    profilesList.replaceChildren();
    membersPanel.hidden = true;

    showMessage(
      "Could not load profiles: " + error.message
    );

    console.error("PairHi admin loading error:", error);

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

async function initializeAdmin() {
  try {
    showMessage("Checking your PairHi login...");

    const { data, error } = await adminClient.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      showMessage(
        "You are not logged in. First log in to PairHi using your administrator account."
      );

      addText(
        messageElement.parentElement,
        "p",
        "After logging in, open this Admin Dashboard again."
      );

      loadButton.hidden = true;
      logoutButton.hidden = true;
      return;
    }

    const { data: userData, error: userError } =
      await adminClient.auth.getUser();

    if (userError) throw userError;

    showMessage(
      "Checking administrator permissions for " +
      userData.user.email +
      "..."
    );

    logoutButton.hidden = false;

    // The database function verifies actual administrator access.
    await loadProfiles();

    loadButton.hidden = false;

  } catch (error) {
    showMessage(
      "Administrator access check failed: " + error.message
    );

    membersPanel.hidden = true;
    console.error("PairHi admin access error:", error);
  }
}

loadButton.addEventListener("click", loadProfiles);

logoutButton.addEventListener("click", async () => {
  try {
    const { error } = await adminClient.auth.signOut();

    if (error) throw error;

    membersPanel.hidden = true;
    loadButton.hidden = true;
    logoutButton.hidden = true;

    profilesList.replaceChildren();

    showMessage("You have logged out successfully.");

  } catch (error) {
    showMessage("Logout error: " + error.message);
  }
});

initializeAdmin();
