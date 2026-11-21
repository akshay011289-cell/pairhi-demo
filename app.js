
const SUPABASE_URL = "https://nckkelnaxivmynmsktoa.supabase.co";
const SUPABASE_KEY = "sb_publishable_xlqXiXGxnQ5CXfSKr5DpyQ_WPMIgibr";

if (
  !window.supabase ||
  typeof window.supabase.createClient !== "function"
) {
  console.error("PAIRHI ERROR: Supabase library failed to load.");
  throw new Error("Supabase JavaScript library is unavailable.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

const $ = id => document.getElementById(id);

const ALLOWED_GOALS = [
  "marriage",
  "serious_relationship",
  "marriage_oriented_serious_relationship"
];

const MAX_PROFILE_PHOTOS = 6;

function goalValue(value) {
  const goal = String(value || "").trim();

  const goalMap = {
    "Marriage": "marriage",
    "Long-term Serious Relationship": "serious_relationship",
    "Long-term relationship": "serious_relationship",
    "Marriage-Oriented Serious Relationship":
      "marriage_oriented_serious_relationship",
    "marriage": "marriage",
    "serious_relationship": "serious_relationship",
    "marriage_oriented_serious_relationship":
      "marriage_oriented_serious_relationship"
  };

  const normalized = goalMap[goal];

  return ALLOWED_GOALS.includes(normalized)
    ? normalized
    : "marriage";
}

function goalLabel(value) {
  const labels = {
    marriage: "Marriage",
    serious_relationship: "Long-term Serious Relationship",
    marriage_oriented_serious_relationship:
      "Marriage-Oriented Serious Relationship"
  };

  return labels[value] || "Marriage";
}

function showMessage(message) {
  const messageBox = $("authMessage");
  if (messageBox) messageBox.textContent = message;
}

function showProfileMessage(message) {
  const messageBox = $("profileMessage");
  if (messageBox) messageBox.textContent = message;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// ======================================
// PHOTO GALLERY HELPERS
// ======================================

function isPhotoFile(file) {
  return Boolean(
    file &&
    file.name &&
    /\.(jpg|jpeg|png|webp)$/i.test(file.name)
  );
}

async function getMyPhotoFiles(userId) {
  const { data, error } = await supabaseClient.storage
    .from("profile-photos")
    .list(userId, {
      limit: 100,
      sortBy: {
        column: "created_at",
        order: "desc"
      }
    });

  if (error) throw error;

  return (data || []).filter(isPhotoFile);
}

// ======================================
// FULL-SCREEN PHOTO VIEWER
// Supports the viewer in the new HTML
// ======================================

function openPhotoViewer(imageUrl) {
  let viewer =
    $("photoViewerDialog") ||
    $("pairhiPhotoViewer");

  let viewerImage =
    $("photoViewerImage") ||
    $("pairhiPhotoViewerImage");

  if (viewer && !(viewer instanceof HTMLDialogElement)) {
    viewer.remove();
    viewer = null;
    viewerImage = null;
  }

  if (!viewer) {
    viewer = document.createElement("dialog");
    viewer.id = "pairhiPhotoViewer";

    viewer.style.cssText =
      "position:fixed;inset:0;margin:auto;padding:16px;" +
      "border:0;border-radius:12px;background:#111;color:white;" +
      "width:calc(100% - 24px);max-width:900px;" +
      "max-height:92vh;overflow:auto;box-sizing:border-box;";

    const style = document.createElement("style");
    style.textContent =
      "#pairhiPhotoViewer::backdrop{background:rgba(0,0,0,.94)}";
    document.head.appendChild(style);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "✕";
    closeButton.setAttribute("aria-label", "Close enlarged photo");
    closeButton.style.cssText =
      "display:block;position:sticky;top:0;margin:0 0 12px auto;" +
      "width:44px;height:44px;border:0;border-radius:50%;" +
      "background:white;color:#222;font-size:24px;font-weight:bold;";

    viewerImage = document.createElement("img");
    viewerImage.id = "pairhiPhotoViewerImage";
    viewerImage.alt = "Full size PairHi profile photograph";
    viewerImage.style.cssText =
      "display:block;width:100%;max-width:100%;max-height:78vh;" +
      "object-fit:contain;border-radius:8px;margin:0 auto;";

    closeButton.addEventListener("click", () => {
      if (viewer.open) viewer.close();
    });

    viewer.addEventListener("click", event => {
      if (event.target === viewer && viewer.open) viewer.close();
    });

    viewer.addEventListener("close", () => {
      viewerImage.removeAttribute("src");
    });

    viewer.appendChild(closeButton);
    viewer.appendChild(viewerImage);
    document.body.appendChild(viewer);
  }

  if (!viewerImage) {
    viewerImage =
      viewer.querySelector("img") ||
      $("photoViewerImage");
  }

  if (!viewerImage) {
    throw new Error("Photo viewer image element is missing.");
  }

  viewerImage.src = imageUrl;

  if (!viewer.open) viewer.showModal();
}

// ======================================
// UPDATE MAIN PROFILE PHOTO
// ======================================

async function setMainProfilePhoto(userId, photoPath) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .update({ photo_url: photoPath })
    .eq("id", userId)
    .select("id, photo_url")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "Could not update your main photo. Please check your profile permissions."
    );
  }

  return data;
}

// ======================================
// DELETE PROFILE PHOTO
// ======================================

async function deleteMyProfilePhoto(userId, photoPath) {
  try {
    const files = await getMyPhotoFiles(userId);

    const photoExists = files.some(
      file => userId + "/" + file.name === photoPath
    );

    if (!photoExists) {
      throw new Error("This photograph could not be found.");
    }

    if (files.length <= 1) {
      throw new Error(
        "You must keep at least one profile photograph. Upload another photo before deleting this one."
      );
    }

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("photo_url")
        .eq("id", userId)
        .single();

    if (profileError) throw profileError;

    let newMainPhoto = profile.photo_url || "";

    if (photoPath === newMainPhoto) {
      const replacement = files.find(
        file => userId + "/" + file.name !== photoPath
      );

      if (!replacement) {
        throw new Error("No replacement main photo is available.");
      }

      newMainPhoto = userId + "/" + replacement.name;
      await setMainProfilePhoto(userId, newMainPhoto);
    }

    const { error: deleteError } = await supabaseClient.storage
      .from("profile-photos")
      .remove([photoPath]);

    if (deleteError) throw deleteError;

    await loadMyPhotoGallery(userId, newMainPhoto);
    await refreshMyProfileSummary();

    showProfileMessage("Photograph deleted successfully.");

  } catch (error) {
    console.error("PAIRHI PHOTO DELETE ERROR:", error);
    showProfileMessage(
      "Could not delete photograph: " + error.message
    );
  }
}

// ======================================
// PRIVATE PROFILE PHOTO GALLERY
// ======================================

async function loadMyPhotoGallery(userId, mainPhotoPath) {
  const gallery = $("myPhotoGallery");
  const message = $("photoGalleryMessage");

  if (!gallery) return;

  gallery.replaceChildren();

  if (message) {
    message.textContent = "Loading your uploaded photographs...";
  }

  try {
    const photoFiles = await getMyPhotoFiles(userId);

    if (photoFiles.length === 0) {
      if (message) {
        message.textContent =
          "You have not uploaded any photographs yet.";
      }
      return;
    }

    const photos = photoFiles.map(file => ({
      name: file.name,
      path: userId + "/" + file.name
    }));

    photos.sort((a, b) => {
      if (a.path === mainPhotoPath) return -1;
      if (b.path === mainPhotoPath) return 1;
      return 0;
    });

    const photoResults = await Promise.all(
      photos.map(async photo => {
        try {
          const { data, error } = await supabaseClient.storage
            .from("profile-photos")
            .createSignedUrl(photo.path, 3600);

          if (error || !data?.signedUrl) return null;

          return {
            ...photo,
            signedUrl: data.signedUrl
          };
        } catch (error) {
          console.warn("Photo URL request failed:", photo.path, error);
          return null;
        }
      })
    );

    const availablePhotos = photoResults.filter(Boolean);

    if (availablePhotos.length === 0) {
      if (message) {
        message.textContent =
          "Your photographs could not be loaded. Please try again.";
      }
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const photo of availablePhotos) {
      const item = document.createElement("div");

      item.style.cssText =
        "min-width:0;border:1px solid #eadfe3;" +
        "border-radius:12px;overflow:hidden;" +
        "background:#fff;padding:6px;";

      const imageButton = document.createElement("button");
      imageButton.type = "button";
      imageButton.setAttribute("aria-label", "Open photograph");
      imageButton.style.cssText =
        "display:block;width:100%;padding:0;border:0;" +
        "background:transparent;cursor:pointer;";

      const image = document.createElement("img");
      image.src = photo.signedUrl;
      image.alt = "My uploaded PairHi photograph";
      image.loading = "lazy";
      image.decoding = "async";
      image.style.cssText =
        "display:block;width:100%;aspect-ratio:1/1;" +
        "object-fit:cover;border-radius:8px;";

      imageButton.appendChild(image);
      imageButton.addEventListener("click", () => {
        try {
          openPhotoViewer(photo.signedUrl);
        } catch (error) {
          console.error("PAIRHI PHOTO VIEWER ERROR:", error);
          showProfileMessage(
            "Could not open photograph: " + error.message
          );
        }
      });

      item.appendChild(imageButton);

      const isMainPhoto = photo.path === mainPhotoPath;

      const label = document.createElement("div");
      label.textContent = isMainPhoto
        ? "Main Profile Photo"
        : "Uploaded Photo";
      label.style.cssText =
        "font-size:11px;font-weight:700;color:#8f3658;" +
        "text-align:center;padding:8px 2px;";

      item.appendChild(label);

      if (!isMainPhoto) {
        const mainButton = document.createElement("button");
        mainButton.type = "button";
        mainButton.textContent = "Make Main Photo";
        mainButton.style.cssText =
          "display:block;width:100%;padding:9px 4px;" +
          "margin:3px 0;border:0;border-radius:7px;" +
          "background:#c52b68;color:white;font-size:11px;" +
          "font-weight:700;cursor:pointer;";

        mainButton.addEventListener("click", async () => {
          if (!confirm("Make this your main profile photograph?")) return;

          mainButton.disabled = true;
          showProfileMessage("Updating your main photograph...");

          try {
            await setMainProfilePhoto(userId, photo.path);
            await loadMyPhotoGallery(userId, photo.path);
            await refreshMyProfileSummary();

            showProfileMessage(
              "Your main profile photograph has been changed successfully."
            );
          } catch (error) {
            console.error("PAIRHI MAIN PHOTO ERROR:", error);
            showProfileMessage(
              "Could not change main photo: " + error.message
            );
            mainButton.disabled = false;
          }
        });

        item.appendChild(mainButton);
      }

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete Photo";
      deleteButton.style.cssText =
        "display:block;width:100%;padding:9px 4px;" +
        "margin:3px 0;border:1px solid #d9534f;" +
        "border-radius:7px;background:white;color:#c0392b;" +
        "font-size:11px;font-weight:700;cursor:pointer;";

      deleteButton.addEventListener("click", async () => {
        const confirmed = confirm(
          isMainPhoto
            ? "You are deleting your main photo. Another uploaded photo will automatically become your main photo. Continue?"
            : "Are you sure you want to permanently delete this photograph?"
        );

        if (!confirmed) return;

        deleteButton.disabled = true;
        await deleteMyProfilePhoto(userId, photo.path);
        deleteButton.disabled = false;
      });

      item.appendChild(deleteButton);
      fragment.appendChild(item);
    }

    gallery.appendChild(fragment);

    if (message) {
      message.textContent =
        "Showing " + availablePhotos.length +
        " of your uploaded photographs. You can upload up to " +
        MAX_PROFILE_PHOTOS + " photos.";
    }

  } catch (error) {
    console.error("PAIRHI PHOTO GALLERY ERROR:", error);

    if (message) {
      message.textContent =
        "Could not load your photographs: " + error.message;
    }
  }
}

// ======================================
// CURRENT SIGNED-IN USER
// ======================================

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) throw error;
  if (!data.session) return null;

  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;

  return userData.user;
}

// ======================================
// CREATE PROFILE ONLY IF IT DOES NOT EXIST
// ======================================

async function ensureUserProfile(user) {
  const { data: existing, error: readError } =
    await supabaseClient
      .from("profiles")
      .select("id, display_name, city, relationship_goal")
      .eq("id", user.id)
      .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const metadata = user.user_metadata || {};

  const profileData = {
    id: user.id,
    display_name: metadata.display_name || "PairHi Member",
    city: metadata.city || "",
    relationship_goal: goalValue(metadata.relationship_goal)
  };

  const { error: insertError } = await supabaseClient
    .from("profiles")
    .insert(profileData);

  if (insertError) throw insertError;

  const { data: saved, error: verifyError } =
    await supabaseClient
      .from("profiles")
      .select("id, display_name, city, relationship_goal")
      .eq("id", user.id)
      .maybeSingle();

  if (verifyError) throw verifyError;

  if (!saved) {
    throw new Error("Your profile could not be found.");
  }

  return saved;
}

// ======================================
// PROFILE SUMMARY ON MY PROFILE PAGE
// ======================================

function renderMyProfileSummary(profile) {
  const container = $("myProfileSummary");
  if (!container) return;

  container.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex;align-items:center;gap:14px;flex-wrap:wrap;" +
    "padding:16px;border-radius:16px;" +
    "background:linear-gradient(135deg,#fff0f5,#fff8fa);" +
    "border:1px solid #f4d5e1;";

  const photo = document.createElement("img");
  photo.alt = "Your PairHi profile photo";
  photo.style.cssText =
    "width:84px;height:84px;border-radius:50%;" +
    "object-fit:cover;border:3px solid white;" +
    "box-shadow:0 3px 12px rgba(120,30,70,.15);";

  const photoPath = profile.photo_url || "";

  if (photoPath) {
    supabaseClient.storage
      .from("profile-photos")
      .createSignedUrl(photoPath, 3600)
      .then(({ data, error }) => {
        if (!error && data?.signedUrl) {
          photo.src = data.signedUrl;
        }
      })
      .catch(error => {
        console.warn("Profile summary photo:", error);
      });
  }

  const details = document.createElement("div");
  details.style.cssText = "flex:1;min-width:150px;";

  const name = document.createElement("div");
  name.textContent = profile.display_name || "PairHi Member";
  name.style.cssText =
    "font-size:20px;font-weight:800;color:#702443;";

  const basics = document.createElement("div");
  const basicParts = [];

  if (profile.age) basicParts.push(String(profile.age));
  if (profile.city) basicParts.push(profile.city);

  basics.textContent = basicParts.join(" • ");
  basics.style.cssText =
    "font-size:13px;color:#765969;margin-top:5px;";

  const goal = document.createElement("div");
  goal.textContent = goalLabel(profile.relationship_goal);
  goal.style.cssText =
    "font-size:12px;font-weight:700;color:#c02d68;margin-top:7px;";

  const status = document.createElement("div");
  status.textContent =
    "Profile status: " +
    (profile.verification_status || "Pending");
  status.style.cssText =
    "font-size:11px;color:#77616d;margin-top:6px;";

  details.append(name, basics, goal, status);
  wrapper.append(photo, details);
  container.appendChild(wrapper);
}

// ======================================
// LOAD MY PROFILE PAGE
// INLINE PROFILE EDITING — NO EDIT DIALOG
// ======================================

async function loadMyProfilePage() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      const authDialog = $("profileDialog");

      if (authDialog && !authDialog.open) {
        authDialog.showModal();
      }

      showMessage("Please log in to view your PairHi profile.");
      return;
    }

    showProfileMessage("Loading your PairHi profile...");

    await ensureUserProfile(user);

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    if (!profile) throw new Error("Your profile record could not be found.");

    renderMyProfileSummary(profile);

    const fields = {
      profileName: profile.display_name || "",
      profileAge: profile.age ?? "",
      profileGender: profile.gender || "",
      profilePreferredGender: profile.preferred_gender || "",
      profileCity: profile.city || "",
      profilePreferredCity: profile.preferred_city || "",
      profileGoal: goalValue(profile.relationship_goal),
      profileEducation: profile.education || "",
      profileOccupation: profile.occupation || "",
      profileMaritalStatus: profile.marital_status || "",
      profileInterests: profile.interests || "",
      profileLifestyle: profile.lifestyle || "",
      profileMinAge: profile.min_age_preference ?? 18,
      profileMaxAge: profile.max_age_preference ?? 60,
      profileBio: profile.bio || ""
    };

    Object.entries(fields).forEach(([id, value]) => {
      const field = $(id);
      if (field) field.value = value;
    });

    const photoInput = $("profilePhoto");
    if (photoInput) {
      photoInput.value = "";
      photoInput.required = !profile.photo_url;
    }

    await loadMyPhotoGallery(user.id, profile.photo_url || "");

    if (profile.verification_status === "approved") {
      showProfileMessage(
        "Your profile is approved. You can update your details here."
      );
    } else {
      showProfileMessage(
        "Verification status: " +
        (profile.verification_status || "pending") +
        ". Complete your profile and submit it for review."
      );
    }

  } catch (error) {
    console.error("PAIRHI PROFILE PAGE ERROR:", error);

    showProfileMessage(
      "Could not load your profile: " + error.message
    );
  }
}

window.loadMyProfilePage = loadMyProfilePage;

async function refreshMyProfileSummary() {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    if (data) renderMyProfileSummary(data);

  } catch (error) {
    console.warn("Could not refresh profile summary:", error);
  }
}

// Keep the previous public function name working.
// It now opens the inline My Profile page instead of a dialog.
async function openMemberProfile() {
  if (typeof window.showPairHiPage === "function") {
    window.showPairHiPage("profile");
  }

  await loadMyProfilePage();
}

window.openMemberProfile = openMemberProfile;

// ======================================
// AUTHENTICATION DIALOG
// ======================================

if ($("signupBtn")) {
  $("signupBtn").addEventListener("click", async () => {
    const name = $("authName")?.value.trim() || "";
    const city = $("authCity")?.value.trim() || "";
    const goal = $("authGoal")?.value || "";
    const email = $("authEmail")?.value.trim() || "";
    const password = $("authPassword")?.value || "";

    if (!name || !city || !email || !password) {
      showMessage("Please complete all fields.");
      return;
    }

    if (!ALLOWED_GOALS.includes(goal)) {
      showMessage("Please select a valid relationship goal.");
      return;
    }

    if (password.length < 8) {
      showMessage("Password must contain at least 8 characters.");
      return;
    }

    try {
      $("signupBtn").disabled = true;
      showMessage("Creating your PairHi account...");

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            "https://akshay011289-cell.github.io/pairhi-demo/",
          data: {
            display_name: name,
            city,
            relationship_goal: goal
          }
        }
      });

      if (error) throw error;

      if (data.session && data.user) {
        await ensureUserProfile(data.user);

        if ($("logoutBtn")) $("logoutBtn").hidden = false;

        showMessage(
          "Account created successfully! Your PairHi profile is saved."
        );

        if (typeof window.showPairHiPage === "function") {
          window.showPairHiPage("profile");
        }

        await loadMyProfilePage();

        const authDialog = $("profileDialog");
        if (authDialog?.open) authDialog.close();

      } else {
        showMessage(
          "Registration successful! Please verify your email and then log in."
        );
      }

    } catch (error) {
      showMessage("Registration error: " + error.message);
      console.error("PairHi registration error:", error);

    } finally {
      $("signupBtn").disabled = false;
    }
  });
}

// ======================================
// LOGIN
// ======================================

if ($("loginBtn")) {
  $("loginBtn").addEventListener("click", async () => {
    const email = $("authEmail")?.value.trim() || "";
    const password = $("authPassword")?.value || "";

    if (!email || !password) {
      showMessage("Enter your email and password.");
      return;
    }

    try {
      $("loginBtn").disabled = true;
      showMessage("Logging in to PairHi...");

      const { data, error } = await supabaseClient.auth
        .signInWithPassword({ email, password });

      if (error) throw error;

      const savedProfile = await ensureUserProfile(data.user);

      if ($("logoutBtn")) $("logoutBtn").hidden = false;

      showMessage(
        "Welcome to PairHi, " +
        savedProfile.display_name +
        "! Your profile is connected."
      );

      const authDialog = $("profileDialog");
      if (authDialog?.open) authDialog.close();

      if (typeof window.showPairHiPage === "function") {
        window.showPairHiPage("home");
      }

      await loadMyProfilePage();

      if (typeof window.loadPairHiInbox === "function") {
        window.loadPairHiInbox();
      }

      if (typeof window.loadDiscovery === "function") {
        window.loadDiscovery();
      }

    } catch (error) {
      showMessage("Login error: " + error.message);
      console.error("PairHi login error:", error);

    } finally {
      $("loginBtn").disabled = false;
    }
  });
}

// ======================================
// LOGOUT
// ======================================

if ($("logoutBtn")) {
  $("logoutBtn").addEventListener("click", async () => {
    try {
      $("logoutBtn").disabled = true;

      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      $("logoutBtn").hidden = true;

      const gallery = $("myPhotoGallery");
      if (gallery) gallery.replaceChildren();

      const summary = $("myProfileSummary");
      if (summary) summary.textContent = "Log in to view your profile.";

      showMessage("You have logged out successfully.");

      if (typeof window.showPairHiPage === "function") {
        window.showPairHiPage("home");
      }

    } catch (error) {
      showMessage("Logout error: " + error.message);
      console.error("PAIRHI LOGOUT ERROR:", error);

    } finally {
      $("logoutBtn").disabled = false;
    }
  });
}

// ======================================
// RESTORE EXISTING LOGIN
// ======================================

async function checkExistingLogin() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session) {
      if ($("logoutBtn")) $("logoutBtn").hidden = false;

      const savedProfile = await ensureUserProfile(data.session.user);

      showMessage(
        "Welcome back, " +
        savedProfile.display_name +
        "! Your profile is connected."
      );

      await loadMyProfilePage();

    } else {
      if ($("logoutBtn")) $("logoutBtn").hidden = true;
    }

  } catch (error) {
    showMessage("Session error: " + error.message);
    console.error("PAIRHI SESSION ERROR:", error);
  }
}

// ======================================
// SAVE PROFILE — INLINE FORM
// ======================================

if ($("editProfileForm")) {
  $("editProfileForm").addEventListener("submit", async event => {
    event.preventDefault();

    const saveButton = $("saveProfileBtn");

    try {
      if (saveButton) saveButton.disabled = true;

      showProfileMessage("Saving your PairHi profile...");

      const user = await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in again before saving your profile."
        );
      }

      const name = $("profileName")?.value.trim() || "";
      const age = Number($("profileAge")?.value);
      const gender = $("profileGender")?.value || "";
      const preferredGender =
        $("profilePreferredGender")?.value || "";
      const city = $("profileCity")?.value.trim() || "";
      const preferredCity =
        $("profilePreferredCity")?.value.trim() || "";
      const goal = $("profileGoal")?.value || "";
      const minAge = Number($("profileMinAge")?.value);
      const maxAge = Number($("profileMaxAge")?.value);
      const bio = $("profileBio")?.value.trim() || "";

      const education =
        $("profileEducation")?.value.trim() || "";
      const occupation =
        $("profileOccupation")?.value.trim() || "";
      const maritalStatus =
        $("profileMaritalStatus")?.value || "";
      const interests =
        $("profileInterests")?.value.trim() || "";
      const lifestyle =
        $("profileLifestyle")?.value.trim() || "";

      const photoInput = $("profilePhoto");
      const photoFile =
        photoInput?.files && photoInput.files[0];

      if (!name || !city || !bio || !gender || !preferredGender) {
        throw new Error(
          "Please complete all required profile fields."
        );
      }

      if (!Number.isInteger(age) || age < 18 || age > 100) {
        throw new Error(
          "Please enter a valid age between 18 and 100."
        );
      }

      if (!ALLOWED_GOALS.includes(goal)) {
        throw new Error(
          "Please select one of the three approved relationship goals."
        );
      }

      if (
        !Number.isInteger(minAge) ||
        !Number.isInteger(maxAge) ||
        minAge < 18 ||
        maxAge > 100 ||
        minAge > maxAge
      ) {
        throw new Error("Please check your preferred age range.");
      }

      if (education.length > 150 || occupation.length > 150) {
        throw new Error(
          "Education and occupation must be 150 characters or fewer."
        );
      }

      if (interests.length > 500 || lifestyle.length > 500) {
        throw new Error(
          "Interests and lifestyle must be 500 characters or fewer."
        );
      }

      if (photoFile) {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (!allowedTypes.includes(photoFile.type)) {
          throw new Error("Please upload a JPG, PNG or WEBP photograph.");
        }

        if (photoFile.size > 5 * 1024 * 1024) {
          throw new Error("Your photograph must be smaller than 5 MB.");
        }
      }

      const { data: existingProfile, error: existingError } =
        await supabaseClient
          .from("profiles")
          .select("photo_url")
          .eq("id", user.id)
          .single();

      if (existingError) throw existingError;

      let photoPath = existingProfile.photo_url || "";

      if (photoFile) {
        const existingPhotos = await getMyPhotoFiles(user.id);

        if (existingPhotos.length >= MAX_PROFILE_PHOTOS) {
          throw new Error(
            "You have reached the maximum limit of 6 photographs. Please delete an existing photo before uploading another."
          );
        }

        const extension =
          photoFile.type === "image/png" ? "png" :
          photoFile.type === "image/webp" ? "webp" : "jpg";

        photoPath =
          user.id + "/avatar-" + Date.now() + "." + extension;

        showProfileMessage("Uploading your photograph...");

        const { error: uploadError } = await supabaseClient.storage
          .from("profile-photos")
          .upload(photoPath, photoFile, {
            upsert: false,
            contentType: photoFile.type
          });

        if (uploadError) throw uploadError;
      }

      const profileData = {
        display_name: name,
        age,
        gender,
        preferred_gender: preferredGender,
        city,
        preferred_city: preferredCity || null,
        relationship_goal: goal,
        education: education || null,
        occupation: occupation || null,
        marital_status: maritalStatus || null,
        interests: interests || null,
        lifestyle: lifestyle || null,
        min_age_preference: minAge,
        max_age_preference: maxAge,
        bio,
        photo_url: photoPath
      };

      showProfileMessage("Saving your profile details...");

      const { data: updatedProfile, error: updateError } =
        await supabaseClient
          .from("profiles")
          .update(profileData)
          .eq("id", user.id)
          .select("id, education, occupation, marital_status, interests, lifestyle")
          .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedProfile) {
        throw new Error(
          "Supabase did not update your profile. Please check your login and profile permissions."
        );
      }

      console.log("PAIRHI SAVED PROFILE:", updatedProfile);

      if (photoInput) {
        photoInput.value = "";
        photoInput.required = false;
      }

      await loadMyPhotoGallery(user.id, photoPath);
      await refreshMyProfileSummary();

      showProfileMessage(
        "Your profile has been saved successfully."
      );

    } catch (error) {
      showProfileMessage(
        "Profile saving error: " + error.message
      );

      console.error("PAIRHI PROFILE SAVE ERROR:", error);

    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });
}

// ======================================
// AUTH STATE CHANGES
// ======================================

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    if ($("logoutBtn")) $("logoutBtn").hidden = false;

    // Defer Supabase queries until after the auth event callback.
    setTimeout(async () => {
      try {
        await ensureUserProfile(session.user);
        await loadMyProfilePage();

        if (typeof window.loadDiscovery === "function") {
          await window.loadDiscovery();
        }

        if (typeof window.loadPairHiInbox === "function") {
          await window.loadPairHiInbox();
        }
      } catch (error) {
        console.error("PAIRHI SIGN-IN REFRESH ERROR:", error);
      }
    }, 0);
  }

  if (event === "SIGNED_OUT") {
    if ($("logoutBtn")) $("logoutBtn").hidden = true;
  }
});

// ======================================
// FOOTER YEAR
// ======================================

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

// ======================================
// STARTUP
// ======================================

checkExistingLogin();

// ======================================
// SERVICE WORKER
// ======================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => {
        console.log("Service worker:", error);
      });
  });
}
