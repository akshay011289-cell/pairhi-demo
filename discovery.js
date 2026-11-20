
/* ==========================================
   PAIRHI REAL MEMBER DISCOVERY
   Uses the existing Supabase client.
========================================== */

let discoveryCandidates = [];
let discoveryIndex = 0;
let discoveryUser = null;
let discoveryBusy = false;
let discoveryLoading = false;

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

function goalDatabaseValue(value) {
  if (value === "Marriage") return "marriage";
  if (value === "Long-term relationship") {
    return "serious_relationship";
  }
  return null;
}

async function loadDiscovery() {
  if (discoveryLoading) return;

  discoveryLoading = true;
  discoveryCandidates = [];
  discoveryIndex = 0;
  hideDiscoveryCard();

  try {
    discoveryMessage("Loading real PairHi members...");

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
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

    // Read profiles visible under the existing RLS policy.
    const { data: members, error: membersError } =
      await supabaseClient
        .from("profiles")
        .select(
          "id,display_name,age,gender,preferred_gender," +
          "min_age_preference,max_age_preference,city," +
          "bio,relationship_goal,photo_url"
        )
        .eq("verification_status", "approved")
        .neq("id", user.id);

    if (membersError) throw membersError;

    // Read this member's outgoing likes.
    const { data: likes, error: likesError } =
      await supabaseClient
        .from("likes")
        .select("liked_user_id")
        .eq("liker_id", user.id);

    if (likesError) throw likesError;

    // Read this member's saved passes.
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

    const selectedGoal = discovery$("intentFilter")
      ? goalDatabaseValue(discovery$("intentFilter").value)
      : null;

    const targetCity = normalizeCity(cityToUse);

    discoveryCandidates = (members || []).filter(member => {
      if (!member.age || !member.gender) return false;

      // Exclude profiles already liked or passed.
      if (alreadyLiked.has(member.id)) return false;
      if (alreadyPassed.has(member.id)) return false;

      // Apply the current member's age preference.
      if (
        member.age < myProfile.min_age_preference ||
        member.age > myProfile.max_age_preference
      ) {
        return false;
      }

      // Apply the current member's gender preference.
      if (
        !compatibleGender(
          myProfile.preferred_gender,
          member.gender
        )
      ) {
        return false;
      }

      // Check that the candidate is also compatible.
      if (
        !compatibleGender(
          member.preferred_gender,
          myProfile.gender
        )
      ) {
        return false;
      }

      // Check reciprocal age preference.
      if (
        myProfile.age < (member.min_age_preference || 18) ||
        myProfile.age > (member.max_age_preference || 100)
      ) {
        return false;
      }

      // Use preferred city, or own city if not specified.
      if (normalizeCity(member.city) !== targetCity) {
        return false;
      }

      // Apply the discovery intention filter.
      if (
        selectedGoal &&
        member.relationship_goal !== selectedGoal
      ) {
        return false;
      }

      return true;
    });

    if (discoveryCandidates.length === 0) {
      discoveryMessage(
        "No compatible approved members are available in " +
        cityToUse +
        " yet. New approved members will appear here automatically."
      );
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

async function renderRealCandidate() {
  if (discoveryIndex >= discoveryCandidates.length) {
    hideDiscoveryCard();

    discoveryMessage(
      "You've viewed all currently available compatible profiles. " +
      "Check again when more members join."
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

  discovery$("personName").textContent =
    (member.display_name || "PairHi Member") +
    ", " + member.age;

  discovery$("personLocation").textContent =
    (member.city || "") + " · India";

  const goals = {
    marriage: "Marriage",
    serious_relationship: "Serious relationship",
    friendship: "Friendship"
  };

  discovery$("personIntent").textContent =
    goals[member.relationship_goal] || "Connection";

  discovery$("personBio").textContent =
    member.bio || "This member has not added a bio yet.";

  discovery$("personTags").replaceChildren();

  discovery$("compatScore").textContent =
    "Preferences compatible";

  discovery$("photoNumber").textContent =
    (discoveryIndex + 1) +
    " / " +
    discoveryCandidates.length;

  const badge = photo.querySelector(".verified");

  if (badge) {
    badge.textContent = "✓ Approved member";
  }

  // Use a neutral background if no photograph is available.
  photo.style.background =
    "linear-gradient(140deg,#d8a6b8,#92566b)";

  const oldImage = photo.querySelector("img");
  if (oldImage) oldImage.remove();

  // Generate a temporary private photo URL.
  if (member.photo_url) {
    try {
      const { data, error } =
        await supabaseClient.storage
          .from("profile-photos")
          .createSignedUrl(member.photo_url, 3600);

      if (!error && data && data.signedUrl) {
        const image = document.createElement("img");

        image.src = data.signedUrl;
        image.alt = "Approved member profile photograph";
        image.loading = "lazy";

        image.style.position = "absolute";
        image.style.inset = "0";
        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "cover";
        image.style.borderRadius = "inherit";
        image.style.zIndex = "1";

        if (badge) badge.style.zIndex = "2";

        const number = discovery$("photoNumber");
        if (number) number.style.zIndex = "2";

        photo.appendChild(image);
      }
    } catch (photoError) {
      console.warn(
        "Profile photo could not be loaded:",
        photoError
      );
    }
  }

  discoveryMessage(
    "Review this approved member and choose Interested or Pass."
  );
}

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

      discoveryMessage(
        "Your interest has been saved. If this member also likes you, " +
        "a mutual match can be created."
      );

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

// Intercept old demo button handlers.
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

// Replace demo wording with live discovery wording.
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

// Load when the existing Supabase session is available.
supabaseClient.auth.onAuthStateChange(() => {
  window.setTimeout(() => {
    loadDiscovery();
  }, 0);
});

loadDiscovery();
