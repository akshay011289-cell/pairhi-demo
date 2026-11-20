const SUPABASE_URL = "https://nckkelnaxivmynmsktoa.supabase.co";
const SUPABASE_KEY = "sb_publishable_xlqXiXGxnQ5CXfSKr5DpyQ_WPMIgibr";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

function showMessage(message) {
  const messageBox = $("authMessage");
  if (messageBox) messageBox.textContent = message;
}

function showProfileMessage(message) {
  const messageBox = $("profileMessage");
  if (messageBox) messageBox.textContent = message;
}

function goalValue(value) {
  const goalMap = {
    "Marriage": "marriage",
    "Long-term relationship": "serious_relationship",
    "Friendship": "friendship",
    "serious_relationship": "serious_relationship",
    "marriage": "marriage",
    "friendship": "friendship"
  };

  return goalMap[value] || "marriage";
}

// ======================================
// GET CURRENT SIGNED-IN USER
// ======================================

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error) throw error;
  return data.user;
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

  const { error: insertError } =
    await supabaseClient
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
  if (!saved) throw new Error("Your profile could not be found.");

  return saved;
}

// ======================================
// CREATE ACCOUNT
// ======================================

if ($("signupBtn")) {
  $("signupBtn").addEventListener("click", async () => {
    const name = $("authName").value.trim();
    const city = $("authCity").value.trim();
    const goal = $("authGoal").value;
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (!name || !city || !email || !password) {
      showMessage("Please complete all fields.");
      return;
    }

    if (password.length < 8) {
      showMessage("Password must contain at least 8 characters.");
      return;
    }

    try {
      $("signupBtn").disabled = true;
      showMessage("Creating your PairHi account...");

      const { data, error } =
        await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              "https://akshay011289-cell.github.io/pairhi-demo/",
            data: {
              display_name: name,
              city: city,
              relationship_goal: goal
            }
          }
        });

      if (error) throw error;

      if (data.session && data.user) {
        await ensureUserProfile(data.user);
        $("logoutBtn").hidden = false;

        showMessage(
          "Account created successfully! Your PairHi profile is saved."
        );
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
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (!email || !password) {
      showMessage("Enter your email and password.");
      return;
    }

    try {
      $("loginBtn").disabled = true;
      showMessage("Logging in to PairHi...");

      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      const savedProfile = await ensureUserProfile(data.user);

      $("logoutBtn").hidden = false;

      showMessage(
        "Welcome to PairHi, " +
        savedProfile.display_name +
        "! Your profile is saved."
      );

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
      const { error } =
        await supabaseClient.auth.signOut();

      if (error) throw error;

      $("logoutBtn").hidden = true;
      showMessage("You have logged out successfully.");

    } catch (error) {
      showMessage("Logout error: " + error.message);
      console.error(error);
    }
  });
}

// ======================================
// RESTORE EXISTING LOGIN
// ======================================

async function checkExistingLogin() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    if (data.session) {
      $("logoutBtn").hidden = false;

      const savedProfile =
        await ensureUserProfile(data.session.user);

      showMessage(
        "Welcome back, " +
        savedProfile.display_name +
        "! Your profile is connected."
      );

    } else {
      $("logoutBtn").hidden = true;
    }

  } catch (error) {
    showMessage("Session error: " + error.message);
    console.error(error);
  }
}

// ======================================
// OPEN MEMBER PROFILE EDITOR
// ======================================

async function openMemberProfile() {
  try {
    const editor = $("editProfileDialog");

    if (!editor) {
      throw new Error(
        "The editProfileDialog element is missing from index.html."
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      const authDialog = $("profileDialog");

      if (authDialog && !authDialog.open) {
        authDialog.showModal();
      }

      showMessage("Please log in to edit your PairHi profile.");
      return;
    }

    showProfileMessage("Loading your PairHi profile...");

    await ensureUserProfile(user);

    const { data: profile, error } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) throw error;

    if (!profile) {
      throw new Error("Your profile record could not be found.");
    }

    // Fill in profile information.

    $("profileName").value =
      profile.display_name || "";

    $("profileAge").value =
      profile.age ?? "";

    $("profileGender").value =
      profile.gender || "";

    $("profilePreferredGender").value =
      profile.preferred_gender || "";

    $("profileCity").value =
      profile.city || "";

    $("profilePreferredCity").value =
      profile.preferred_city || "";

    $("profileGoal").value =
      profile.relationship_goal || "marriage";

    $("profileMinAge").value =
      profile.min_age_preference ?? 18;

    $("profileMaxAge").value =
      profile.max_age_preference ?? 60;

    $("profileBio").value =
      profile.bio || "";

    $("profilePhoto").value = "";

    $("profilePhoto").required =
      !profile.photo_url;

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

    if (!editor.open) {
      editor.showModal();
    }

  } catch (error) {
    console.error("PAIRHI PROFILE ERROR:", error);

    showProfileMessage(
      "Could not open your profile: " + error.message
    );

    alert(
      "PAIRHI PROFILE ERROR:\n" + error.message
    );
  }
}

// Make the function available to the HTML button.
window.openMemberProfile = openMemberProfile;

// Connect the My Profile button.
const profileButton = $("profileBtn");

if (profileButton) {
  profileButton.addEventListener("click", function(event) {
    event.preventDefault();
    openMemberProfile();
  });
} else {
  console.error(
    "PAIRHI ERROR: profileBtn was not found in index.html."
  );
}

// ======================================
// SAVE MEMBER PROFILE AND PHOTO
// ======================================

if ($("editProfileForm")) {
  $("editProfileForm").addEventListener("submit", async event => {
    event.preventDefault();

    const saveButton = $("saveProfileBtn");

    try {
      saveButton.disabled = true;
      showProfileMessage("Saving your PairHi profile...");

      const user = await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in again before saving your profile."
        );
      }

      const name = $("profileName").value.trim();
      const age = Number($("profileAge").value);
      const gender = $("profileGender").value;
      const preferredGender =
        $("profilePreferredGender").value;
      const city = $("profileCity").value.trim();
      const preferredCity =
        $("profilePreferredCity").value.trim();
      const goal = $("profileGoal").value;
      const minAge = Number($("profileMinAge").value);
      const maxAge = Number($("profileMaxAge").value);
      const bio = $("profileBio").value.trim();
      const photoInput = $("profilePhoto");
      const photoFile =
        photoInput.files && photoInput.files[0];

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

      if (
        !Number.isInteger(minAge) ||
        !Number.isInteger(maxAge) ||
        minAge < 18 ||
        maxAge > 100 ||
        minAge > maxAge
      ) {
        throw new Error(
          "Please check your preferred age range."
        );
      }

      if (photoFile) {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (!allowedTypes.includes(photoFile.type)) {
          throw new Error(
            "Please upload a JPG, PNG or WEBP photograph."
          );
        }

        if (photoFile.size > 5 * 1024 * 1024) {
          throw new Error(
            "Your photograph must be smaller than 5 MB."
          );
        }
      }

      // Read existing saved photo path.

      const { data: existingProfile, error: existingError } =
        await supabaseClient
          .from("profiles")
          .select("photo_url")
          .eq("id", user.id)
          .single();

      if (existingError) throw existingError;

      let photoPath =
        existingProfile.photo_url || "";

      // Upload a new photograph if selected.

      if (photoFile) {
        const extension =
          photoFile.type === "image/png" ? "png" :
          photoFile.type === "image/webp" ? "webp" : "jpg";

        photoPath =
          user.id + "/avatar-" + Date.now() + "." + extension;

        showProfileMessage("Uploading your photograph...");

        const { error: uploadError } =
          await supabaseClient.storage
            .from("profile-photos")
            .upload(photoPath, photoFile, {
              upsert: false,
              contentType: photoFile.type
            });

        if (uploadError) throw uploadError;
      }

      // Verification status is not included.
      // Only an administrator can approve profiles.

      const profileData = {
        display_name: name,
        age: age,
        gender: gender,
        preferred_gender: preferredGender,
        city: city,
        preferred_city: preferredCity || null,
        relationship_goal: goalValue(goal),
        min_age_preference: minAge,
        max_age_preference: maxAge,
        bio: bio,
        photo_url: photoPath
      };

      showProfileMessage("Saving your profile details...");

      const { error: updateError } =
        await supabaseClient
          .from("profiles")
          .update(profileData)
          .eq("id", user.id);

      if (updateError) throw updateError;

      showProfileMessage(
        "Your profile has been saved. It will remain pending until it is reviewed and approved."
      );

      photoInput.value = "";
      photoInput.required = false;

      setTimeout(() => {
        const editor = $("editProfileDialog");

        if (editor && editor.open) {
          editor.close();
        }
      }, 1800);

    } catch (error) {
      showProfileMessage(
        "Profile saving error: " + error.message
      );

      console.error(
        "PairHi profile saving error:",
        error
      );

    } finally {
      saveButton.disabled = false;
    }
  });
}

// ======================================
// PAIRHI DEMO DISCOVERY PROFILES
// These are sample profiles, not real users.
// ======================================

const profiles = [
  {
    name: "Aarohi",
    age: 28,
    city: "Delhi",
    intent: "Marriage",
    bio: "I value kindness, family, honest communication and building a life with shared purpose. I enjoy books, travel and trying new food.",
    tags: ["Family-oriented", "Travel", "Reading"],
    score: "Strong values overlap",
    photo: "linear-gradient(140deg,#d8a6a5,#92566b)"
  },
  {
    name: "Rohan",
    age: 30,
    city: "Jaipur",
    intent: "Long-term relationship",
    bio: "Grounded, curious and close to my family. Looking for a respectful partnership where both people grow together.",
    tags: ["Entrepreneurship", "Fitness", "Culture"],
    score: "Good potential",
    photo: "linear-gradient(140deg,#c5a18b,#805e52)"
  },
  {
    name: "Meera",
    age: 27,
    city: "Pune",
    intent: "Marriage",
    bio: "A thoughtful person who loves music, meaningful conversations and weekend nature escapes. Honesty matters most to me.",
    tags: ["Music", "Nature", "Family"],
    score: "Strong values overlap",
    photo: "linear-gradient(140deg,#d6a7b8,#a45e7d)"
  },
  {
    name: "Kabir",
    age: 31,
    city: "Mumbai",
    intent: "Long-term relationship",
    bio: "I believe a strong relationship is built on friendship, trust and laughter. Hoping to meet someone intentional and kind.",
    tags: ["Design", "Cooking", "Films"],
    score: "Good potential",
    photo: "linear-gradient(140deg,#c4a88b,#715e55)"
  }
];

let current = null;
let index = 0;

function render() {
  const filterElement = $("intentFilter");

  if (!filterElement) return;

  const filter = filterElement.value;

  const visible = profiles.filter(
    p => filter === "all" || p.intent === filter
  );

  if (!visible.length) {
    $("feedback").textContent =
      "No sample profiles in this category.";
    return;
  }

  current = visible[index % visible.length];

  $("personName").textContent =
    `${current.name}, ${current.age}`;

  $("personLocation").textContent =
    `${current.city} · India`;

  $("personIntent").textContent =
    current.intent;

  $("personBio").textContent =
    current.bio;

  $("personTags").innerHTML = current.tags
    .map(t => `<span>${t}</span>`)
    .join("");

  $("compatScore").textContent =
    current.score;

  $("photo").style.background =
    current.photo;

  $("photoNumber").textContent =
    `${(index % visible.length) + 1} / ${visible.length}`;
}

function advance(message) {
  $("feedback").textContent = message;
  index++;
  render();
}

if ($("skipBtn")) {
  $("skipBtn").addEventListener("click", () => {
    advance(
      "Passed on this sample profile. Your next discovery is ready."
    );
  });
}

if ($("likeBtn")) {
  $("likeBtn").addEventListener("click", () => {
    if (!current) return;

    advance(
      `Interest recorded in this local demo for ${current.name}. Real mutual matching requires registered users.`
    );
  });
}

if ($("intentFilter")) {
  $("intentFilter").addEventListener("change", () => {
    index = 0;
    render();

    $("feedback").textContent =
      "Showing profiles for your selected intention.";
  });
}

// ======================================
// FOOTER AND STARTUP
// ======================================

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

render();
checkExistingLogin();

// ======================================
// SERVICE WORKER
// ======================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error =>
        console.log("Service worker:", error)
      );
  });
}
