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

// Prevent overlapping profile loads from appending duplicate gallery tiles.
let pairhiPhotoGalleryLoadSequence = 0;

async function loadMyPhotoGallery(userId, mainPhotoPath) {
  const loadSequence = ++pairhiPhotoGalleryLoadSequence;
  const gallery = $("myPhotoGallery");
  const message = $("photoGalleryMessage");

  if (!gallery) return;

  gallery.replaceChildren();

  if (message) {
    message.textContent = "Loading your uploaded photographs...";
  }

  try {
    const photoFiles = await getMyPhotoFiles(userId);

    // A newer gallery request has already started; ignore this older result.
    if (loadSequence !== pairhiPhotoGalleryLoadSequence) return;

    if (photoFiles.length === 0) {
      if (message) {
        message.textContent =
          "You have not uploaded any photographs yet.";
      }
      return;
    }

    // Deduplicate by storage path in case the listing contains repeated entries.
    const uniquePhotoFiles = Array.from(
      new Map(photoFiles.map(file => [file.name, file])).values()
    );
        const photos = uniquePhotoFiles.map(file => ({
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

    // Only the most recent request may render into the gallery.
    if (loadSequence !== pairhiPhotoGalleryLoadSequence) return;

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
    if (loadSequence !== pairhiPhotoGalleryLoadSequence) return;

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
// MY PROFILE PREVIEW + EDITOR
// ======================================

function addMyProfileStyles() {
  if ($("pairhiMyProfileStyles")) return;

  const style = document.createElement("style");
  style.id = "pairhiMyProfileStyles";
  style.textContent = `
    #myProfileSummary { width:100%; }
    .ph-profile-card {
      overflow:hidden;
      border:1px solid #f0dce4;
      border-radius:22px;
      background:#fff;
      box-shadow:0 12px 34px rgba(91,28,56,.08);
    }
    .ph-profile-hero {
      position:relative;
      min-height:320px;
      background:linear-gradient(145deg,#f8dce7,#fceef3 55%,#f7d6e3);
      overflow:hidden;
    }
    .ph-profile-hero img {
      display:block;
      width:100%;
      height:360px;
      object-fit:cover;
      object-position:center 35%;
    }
    .ph-profile-photo-placeholder {
      height:320px;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#b04b75;
      font-size:76px;
    }
    .ph-profile-hero-shade {
      position:absolute;
      inset:35% 0 0;
      background:linear-gradient(transparent,rgba(30,9,20,.76));
      pointer-events:none;
    }
    .ph-profile-hero-copy {
      position:absolute;
      left:20px;
      right:20px;
      bottom:20px;
      color:white;
      z-index:1;
      text-shadow:0 2px 12px rgba(0,0,0,.3);
    }
    .ph-profile-name {
      font-size:27px;
      line-height:1.15;
      font-weight:850;
      letter-spacing:-.4px;
      color:white;
      overflow-wrap:anywhere;
    }
    .ph-profile-basics {
      margin-top:7px;
      font-size:14px;
      font-weight:600;
      color:#fff;
    }
    .ph-profile-status {
      display:inline-flex;
      align-items:center;
      gap:6px;
      margin-top:11px;
      padding:6px 11px;
      border-radius:30px;
      background:rgba(255,255,255,.94);
      
            color:#8e2853;
      font-size:11px;
      font-weight:800;
      text-shadow:none;
    }
    .ph-profile-content { padding:18px; }
    .ph-profile-goal {
      padding:14px 15px;
      border-radius:15px;
      background:linear-gradient(120deg,#fff0f5,#fff8fa);
      border:1px solid #f4d8e3;
      color:#922d59;
      font-size:14px;
      font-weight:800;
      line-height:1.5;
    }
    .ph-profile-section {
      padding:17px 0;
      border-bottom:1px solid #f2e8ec;
    }
    .ph-profile-section:last-of-type { border-bottom:0; }
    .ph-profile-section h3 {
      margin:0 0 9px;
      color:#702443;
      font-size:15px;
      font-weight:850;
    }
    .ph-profile-section p {
      margin:0;
      color:#66535e;
      font-size:14px;
      line-height:1.75;
      overflow-wrap:anywhere;
      white-space:pre-wrap;
    }
    .ph-profile-facts {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }
    .ph-profile-fact {
      min-width:0;
      padding:12px;
      border-radius:13px;
      background:#fff8fa;
      border:1px solid #f4e5eb;
    }
    .ph-profile-fact small {
      display:block;
      margin-bottom:5px;
      color:#967987;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.65px;
    }
    .ph-profile-fact strong {
      display:block;
      color:#553344;
      font-size:13px;
      line-height:1.45;
      overflow-wrap:anywhere;
    }
    .ph-profile-tags {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }
    .ph-profile-tag {
      padding:8px 11px;
      border-radius:30px;
      background:#fff0f5;
      border:1px solid #f3d8e3;
      color:#9a315d;
      font-size:12px;
      font-weight:700;
    }
    .ph-profile-edit-btn {
      width:100%;
      margin-top:16px;
      padding:14px 18px;
      border:0;
      border-radius:14px;
      background:linear-gradient(100deg,#ed294e,#d62c83);
      color:white;
      font-size:14px;
      font-weight:800;
      cursor:pointer;
      box-shadow:0 7px 18px rgba(214,44,105,.2);
    }
    .ph-profile-empty {
      padding:22px 16px;
      text-align:center;
      color:#765969;
      line-height:1.7;
    }
    .ph-profile-editor-actions {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin:0 0 16px;
    }
    .ph-profile-cancel-btn {
      padding:11px 16px;
      border:1px solid #e8cbd7;
      border-radius:10px;
      background:#fff;
      color:#8d3158;
      font-weight:750;
      cursor:pointer;
    }
    @media (max-width:420px) {
      .ph-profile-hero img { height:330px; }
      .ph-profile-content { padding:15px; }
      .ph-profile-name { font-size:24px; }
      .ph-profile-facts { gap:8px; }
    }
  `;
  document.head.appendChild(style);
}

function profileText(value, fallback = "Not added yet") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function addProfileSection(container, heading, content) {
  const section = document.createElement("section");
  section.className = "ph-profile-section";

  const title = document.createElement("h3");
  title.textContent = heading;
  section.appendChild(title);

  if (content instanceof Node) {
    section.appendChild(content);
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = profileText(content);
    section.appendChild(paragraph);
  }

  container.appendChild(section);
  return section;
}

function addProfileFact(grid, label, value) {
  const fact = document.createElement("div");
  fact.className = "ph-profile-fact";

  const caption = document.createElement("small");
  caption.textContent = label;

  const text = document.createElement("strong");
  text.textContent = profileText(value);

  fact.append(caption, text);
  grid.appendChild(fact);
}

function setProfileEditorVisible(visible) {
  const form = $("editProfileForm");
  if (!form) return;

  const panel = form.closest(".pairhi-panel");
  const heading = panel?.previousElementSibling;

  if (panel) panel.hidden = !visible;
  if (heading && heading.classList.contains("pairhi-section-title")) {
    heading.hidden = !visible;
  }

  const summary = $("myProfileSummary");
  const editButton = summary?.querySelector(".ph-profile-edit-btn");
  if (editButton) editButton.hidden = visible;

  if (visible) {
    window.setTimeout(() => {
      if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
      else panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
}

function setupMyProfileEditor() {
  const form = $("editProfileForm");
  if (!form || form.dataset.pairhiEditorReady === "true") return;

  const panel = form.closest(".pairhi-panel");
  const heading = panel?.previousElementSibling;

  if (!panel) return;

  form.dataset.pairhiEditorReady = "true";

  const actions = document.createElement("div");
  actions.className = "ph-profile-editor-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ph-profile-cancel-btn";
  cancelButton.textContent = "Cancel editing";
  cancelButton.addEventListener("click", () => {
    setProfileEditorVisible(false);
    $("myProfileSummary")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  actions.appendChild(cancelButton);
  form.parentNode.insertBefore(actions, form);

  panel.hidden = true;
  if (heading && heading.classList.contains("pairhi-section-title")) {
    heading.hidden = true;
  }
}

function renderMyProfileSummary(profile) {
  const container = $("myProfileSummary");
  if (!container) return;

  addMyProfileStyles();
  setupMyProfileEditor();
  container.replaceChildren();

  const card = document.createElement("article");
  card.className = "ph-profile-card";

  const hero = document.createElement("div");
  hero.className = "ph-profile-hero";

  const photoPath = profile.photo_url || "";
  if (photoPath) {
    const photo = document.createElement("img");
    photo.alt = "Your PairHi profile photograph";
    photo.loading = "eager";
    photo.decoding = "async";
    hero.appendChild(photo);

    supabaseClient.storage
      .from("profile-photos")
      .createSignedUrl(photoPath, 3600)
      .then(({ data, error }) => {
        if (!error && data?.signedUrl && photo.isConnected) {
          photo.src = data.signedUrl;
        }
      })
      .catch(error => console.warn("Profile preview photo:", error));
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "ph-profile-photo-placeholder";
    placeholder.textContent = "♥";
    hero.appendChild(placeholder);
  }

  const shade = document.createElement("div");
  shade.className = "ph-profile-hero-shade";

  const heroCopy = document.createElement("div");
  heroCopy.className = "ph-profile-hero-copy";

  const name = document.createElement("div");
  name.className = "ph-profile-name";
  name.textContent = profileText(profile.display_name, "Your name");

  const basics = document.createElement("div");
  basics.className = "ph-profile-basics";
  const basicParts = [];
  if (profile.age) basicParts.push(String(profile.age));
  if (profile.city) basicParts.push(String(profile.city));
  basics.textContent = basicParts.join("  •  ") || "Complete your profile details";

  const status = document.createElement("span");
  status.className = "ph-profile-status";
  const approved = String(profile.verification_status || "").toLowerCase() === "approved";
  status.textContent = approved ? "✓ Verified PairHi profile" :
    "◷ Profile " + profileText(profile.verification_status, "pending").toLowerCase();

  heroCopy.append(name, basics, status);
  hero.append(shade, heroCopy);

  const content = document.createElement("div");
  content.className = "ph-profile-content";

  const goal = document.createElement("div");
  goal.className = "ph-profile-goal";
  goal.textContent = "♥  " + goalLabel(profile.relationship_goal);
  content.appendChild(goal);

  addProfileSection(content, "About me", profile.bio);

  const facts = document.createElement("div");
  facts.className = "ph-profile-facts";
  addProfileFact(facts, "Gender", profile.gender);
  addProfileFact(facts, "Marital status", profile.marital_status
    ? String(profile.marital_status).replace(/_/g, " ")
    : "");
  addProfileFact(facts, "Education", profile.education);
  addProfileFact(facts, "Profession", profile.occupation);
  addProfileFact(facts, "Preferred city", profile.preferred_city);
  addProfileFact(facts, "Age preference",
    (profile.min_age_preference ?? 18) + " – " +
    (profile.max_age_preference ?? 60) + " years");

  addProfileSection(content, "A little more about you", facts);

  const interestsText = profileText(profile.interests, "");
  if (interestsText) {
    const tags = document.createElement("div");
    tags.className = "ph-profile-tags";
    interestsText.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean)
      .slice(0, 24).forEach(item => {
        const tag = document.createElement("span");
        tag.className = "ph-profile-tag";
        tag.textContent = item;
        tags.appendChild(tag);
      });
    addProfileSection(content, "Interests and hobbies", tags);
  }

  if (String(profile.lifestyle || "").trim()) {
    addProfileSection(content, "Lifestyle", profile.lifestyle);
  }

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "ph-profile-edit-btn";
  editButton.textContent = "✎  Edit my profile";
  editButton.addEventListener("click", () => {
    setProfileEditorVisible(true);
  });

  card.append(hero, content);
  container.append(card, editButton);

  setProfileEditorVisible(false);
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
      setProfileEditorVisible(false);

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
