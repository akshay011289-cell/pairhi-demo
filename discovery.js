
/* ==========================================
   PAIRHI REAL MEMBER DISCOVERY
   Mutual match detection and display
   Uses the existing Supabase client.
========================================== */

let discoveryCandidates = [];
let discoveryIndex = 0;
let discoveryUser = null;
let discoveryBusy = false;
let discoveryLoading = false;
let discoveryMatchedIds = new Set();

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

/* ==========================================
   MATCH DISPLAY
========================================== */

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
    "color:#8f3658;margin:0 0 14px;font-size:22px";

  section.appendChild(heading);

  const description = document.createElement("p");
  description.textContent =
    "These members have also expressed interest in you.";

  description.style.cssText =
    "color:#766d73;margin:0 0 14px;font-size:14px";

  section.appendChild(description);

  profiles.forEach(member => {
    const card = document.createElement("div");

    card.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:14px",
      "padding:12px",
      "margin-bottom:10px",
      "border:1px solid #eadfe3",
      "border-radius:12px"
    ].join(";");

    const avatar = document.createElement("div");

    avatar.textContent =
      (member.display_name || "P").trim().charAt(0).toUpperCase();

    avatar.style.cssText = [
      "width:48px",
      "height:48px",
      "min-width:48px",
      "border-radius:50%",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:#f5dce6",
      "color:#8f3658",
      "font-size:20px",
      "font-weight:bold"
    ].join(";");

    const details = document.createElement("div");
    details.style.flex = "1";

    const name = document.createElement("strong");

    name.textContent =
      (member.display_name || "PairHi Member") +
      (member.age ? ", " + member.age : "");

    name.style.cssText =
      "display:block;color:#29232a;font-size:16px";

    const location = document.createElement("span");

    location.textContent = member.city || "";

    location.style.cssText =
      "display:block;color:#766d73;font-size:13px;margin-top:4px";

    const status = document.createElement("span");

    status.textContent = "♥ Mutual match";

    status.style.cssText =
      "display:block;color:#8f3658;font-size:13px;font-weight:600;margin-top:5px";

    details.appendChild(name);
    details.appendChild(location);
    details.appendChild(status);

    card.appendChild(avatar);
    card.appendChild(details);

    section.appendChild(card);
  });
}

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

  if (discoveryMatchedIds.size === 0) {
    showMatchSection([]);
    return;
  }

  const matchedIds = Array.from(discoveryMatchedIds);

  const { data: profiles, error: profileError } =
    await supabaseClient
      .from("profiles")
      .select("id,display_name,age,city")
      .in("id", matchedIds);

  if (profileError) throw profileError;

  showMatchSection(profiles || []);

  return matchRows;
}

/* ==========================================
   LOAD DISCOVERY
========================================== */

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

    /* Load mutual matches before discovery candidates. */
    await loadMyMatches(user.id);

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
          "bio,relationship_goal,photo_url"
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

    const selectedGoal = discovery$("intentFilter")
      ? goalDatabaseValue(discovery$("intentFilter").value)
      : null;

    const targetCity = normalizeCity(cityToUse);

    discoveryCandidates = (members || []).filter(member => {
      if (!member.age || !member.gender) return false;

      if (alreadyLiked.has(member.id)) return false;
      if (alreadyPassed.has(member.id)) return false;

      if (discoveryMatchedIds.has(member.id)) return false;

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
          " yet. New approved members will appear here automatically."
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

/* ==========================================
   RENDER PROFILE CARD
========================================== */

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

  discovery$("personName").textContent =
    (member.display_name || "PairHi Member") +
    ", " + member.age;

  discovery$("personLocation").textContent =
    (member.city || "") + " · India";

  const goals = {
    marriage: "Marriage",
    serious_relationship: "Serious relationship"
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

  photo.style.background =
    "linear-gradient(140deg,#d8a6b8,#92566b)";

  const oldImage = photo.querySelector("img");

  if (oldImage) oldImage.remove();

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

/* ==========================================
   SAVE INTEREST OR PASS
========================================== */

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

      /*
        The database trigger creates the match.
        We only read the protected matches table here.
      */

      await loadMyMatches(discoveryUser.id);

      if (discoveryMatchedIds.has(member.id)) {
        discoveryMessage(
          "♥ It's a mutual match! " +
          "You and " +
          (member.display_name || "this member") +
          " have both expressed interest. " +
          "Your match is shown above."
        );
      } else {
        discoveryMessage(
          "Your interest has been saved. " +
          "If this member also likes you, a mutual match will appear above."
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

/* ==========================================
   BUTTON EVENTS
========================================== */

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

/* ==========================================
   UPDATE LIVE DISCOVERY WORDING
========================================== */

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

/* ==========================================
   AUTHENTICATION LISTENER
========================================== */

supabaseClient.auth.onAuthStateChange(() => {
  window.setTimeout(() => {
    loadDiscovery();
  }, 0);
});

/* Initial discovery load */
loadDiscovery();
