
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

const $ = id => document.getElementById(id);

// ======================================
// RELATIONSHIP GOALS
// ======================================

const ALLOWED_GOALS = [
  "marriage",
  "serious_relationship",
  "marriage_oriented_serious_relationship"
];

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

// ======================================
// MESSAGE HELPERS
// ======================================

function showMessage(message) {
  const messageBox = $("authMessage");
  if (messageBox) messageBox.textContent = message;
}

function showProfileMessage(message) {
  const messageBox = $("profileMessage");
  if (messageBox) messageBox.textContent = message;
}

// ======================================
// GET CURRENT SIGNED-IN USER
// ======================================

async function getCurrentUser() {
  const { data, error } =
    await supabaseClient.auth.getSession();

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

  if (!saved) {
    throw new Error("Your profile could not be found.");
  }

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

        if ($("logoutBtn")) {
          $("logoutBtn").hidden = false;
        }

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

      const savedProfile =
        await ensureUserProfile(data.user);

      if ($("logoutBtn")) {
        $("logoutBtn").hidden = false;
      }

      showMessage(
        "Welcome to PairHi, " +
        savedProfile.display_name +
        "! Your profile is connected."
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
      if ($("logoutBtn")) {
        $("logoutBtn").hidden = false;
      }

      const savedProfile =
        await ensureUserProfile(data.session.user);

      showMessage(
        "Welcome back, " +
        savedProfile.display_name +
        "! Your profile is connected."
      );

    } else {
      if ($("logoutBtn")) {
        $("logoutBtn").hidden = true;
      }
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

    // Basic profile information.

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
      ALLOWED_GOALS.includes(profile.relationship_goal)
        ? profile.relationship_goal
        : "marriage";

    // NEW PROFILE FIELDS.

    $("profileEducation").value =
      profile.education || "";

    $("profileOccupation").value =
      profile.occupation || "";

    $("profileMaritalStatus").value =
      profile.marital_status || "";

    $("profileInterests").value =
      profile.interests || "";

    $("profileLifestyle").value =
      profile.lifestyle || "";

    // Age preferences.

    $("profileMinAge").value =
      profile.min_age_preference ?? 18;

    $("profileMaxAge").value =
      profile.max_age_preference ?? 60;

    $("profileBio").value =
      profile.bio || "";

    // Photo.

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

// Make function available to the HTML button.
window.openMemberProfile = openMemberProfile;

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

      // Read basic profile fields.

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

      // Read the five additional fields.

      const education =
        $("profileEducation").value.trim();

      const occupation =
        $("profileOccupation").value.trim();

      const maritalStatus =
        $("profileMaritalStatus").value;

      const interests =
        $("profileInterests").value.trim();

      const lifestyle =
        $("profileLifestyle").value.trim();

      const photoInput = $("profilePhoto");

      const photoFile =
        photoInput.files && photoInput.files[0];

      // Validate required information.

      if (
        !name ||
        !city ||
        !bio ||
        !gender ||
        !preferredGender
      ) {
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
        throw new Error(
          "Please check your preferred age range."
        );
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

      // Validate photograph.

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

      // Read existing photo path.

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

      // Save profile information.
      // Verification status remains administrator-controlled.

      const profileData = {
        display_name: name,
        age: age,
        gender: gender,
        preferred_gender: preferredGender,
        city: city,
        preferred_city: preferredCity || null,

        relationship_goal: goal,

        education: education || null,
        occupation: occupation || null,
        marital_status: maritalStatus || null,
        interests: interests || null,
        lifestyle: lifestyle || null,

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
        "Your profile has been saved successfully. It will remain pending until reviewed and approved."
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
