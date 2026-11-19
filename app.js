
const SUPABASE_URL = "https://nckkelnaxivmynmsktoa.supabase.co";
const SUPABASE_KEY = "sb_publishable_xlqXiXGxnQ5CXfSKr5DpyQ_WPMIgibr";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

function showMessage(message) {
  $("authMessage").textContent = message;
}

// Save or find the user's database profile
async function ensureUserProfile(user) {
  const metadata = user.user_metadata || {};

  const { data: existing, error: readError } =
    await supabaseClient
      .from("profiles")
      .select("id, display_name, city")
      .eq("id", user.id)
      .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    return existing;
  }

  const { error: insertError } =
    await supabaseClient
      .from("profiles")
      .insert({
        id: user.id,
        display_name: metadata.display_name || "PairHi Member",
        city: metadata.city || "",
        relationship_goal: metadata.relationship_goal || "Marriage"
      });

  if (insertError) throw insertError;

  const { data: saved, error: verifyError } =
    await supabaseClient
      .from("profiles")
      .select("id, display_name, city")
      .eq("id", user.id)
      .maybeSingle();

  if (verifyError) throw verifyError;
  if (!saved) throw new Error("Profile could not be verified.");

  return saved;
}

// Registration
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
      try {
        await ensureUserProfile(data.user);
        showMessage("Account created and profile saved successfully!");
        $("logoutBtn").hidden = false;
      } catch (profileError) {
        showMessage("Account created, but profile saving failed: " + profileError.message);
      }
    } else {
      showMessage("Registration successful! Check your email and verify your account, then log in.");
    }

  } catch (error) {
    showMessage("Registration error: " + error.message);
    console.error(error);
  } finally {
    $("signupBtn").disabled = false;
  }
});

// Login
$("loginBtn").addEventListener("click", async () => {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  if (!email || !password) {
    showMessage("Enter your email and password.");
    return;
  }

  try {
    $("loginBtn").disabled = true;
    showMessage("Logging in...");

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    await ensureUserProfile(data.user);

    $("logoutBtn").hidden = false;

    showMessage(
      "Welcome to PairHi, " +
      (data.user.user_metadata.display_name || "Member") +
      "! Your profile is saved."
    );

  } catch (error) {
    showMessage("Login error: " + error.message);
    console.error(error);
  } finally {
    $("loginBtn").disabled = false;
  }
});

// Logout
$("logoutBtn").addEventListener("click", async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    $("logoutBtn").hidden = true;
    showMessage("You have logged out successfully.");

  } catch (error) {
    showMessage("Logout error: " + error.message);
  }
});

// Restore an existing login
async function checkExistingLogin() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    if (data.session) {
      $("logoutBtn").hidden = false;

      try {
        await ensureUserProfile(data.session.user);
        showMessage("You are logged in and your profile is connected.");
      } catch (profileError) {
        showMessage("You are logged in, but profile saving failed: " + profileError.message);
      }

    } else {
      $("logoutBtn").hidden = true;
    }

  } catch (error) {
    showMessage("Session error: " + error.message);
    console.error(error);
  }
}

// Original PairHi demo profiles
const profiles = [
 {
  name:"Aarohi",age:28,city:"Delhi",intent:"Marriage",
  bio:"I value kindness, family, honest communication and building a life with shared purpose. I enjoy books, travel and trying new food.",
  tags:["Family-oriented","Travel","Reading"],
  score:"Strong values overlap",
  photo:"linear-gradient(140deg,#d8a6a5,#92566b)"
 },
 {
  name:"Rohan",age:30,city:"Jaipur",intent:"Long-term relationship",
  bio:"Grounded, curious and close to my family. Looking for a respectful partnership where both people grow together.",
  tags:["Entrepreneurship","Fitness","Culture"],
  score:"Good potential",
  photo:"linear-gradient(140deg,#c5a18b,#805e52)"
 },
 {
  name:"Meera",age:27,city:"Pune",intent:"Marriage",
  bio:"A thoughtful person who loves music, meaningful conversations and weekend nature escapes. Honesty matters most to me.",
  tags:["Music","Nature","Family"],
  score:"Strong values overlap",
  photo:"linear-gradient(140deg,#d6a7b8,#a45e7d)"
 },
 {
  name:"Kabir",age:31,city:"Mumbai",intent:"Long-term relationship",
  bio:"I believe a strong relationship is built on friendship, trust and laughter. Hoping to meet someone intentional and kind.",
  tags:["Design","Cooking","Films"],
  score:"Good potential",
  photo:"linear-gradient(140deg,#c4a88b,#715e55)"
 }
];

let current = null;
let index = 0;

function render() {
  const filter = $("intentFilter").value;

  const visible = profiles.filter(
    p => filter === "all" || p.intent === filter
  );

  if (!visible.length) {
    $("feedback").textContent = "No sample profiles in this category.";
    return;
  }

  current = visible[index % visible.length];

  $("personName").textContent = `${current.name}, ${current.age}`;
  $("personLocation").textContent = `${current.city} · India`;
  $("personIntent").textContent = current.intent;
  $("personBio").textContent = current.bio;

  $("personTags").innerHTML = current.tags
    .map(t => `<span>${t}</span>`)
    .join("");

  $("compatScore").textContent = current.score;
  $("photo").style.background = current.photo;
  $("photoNumber").textContent =
    `${(index % visible.length) + 1} / ${visible.length}`;
}

function advance(message) {
  $("feedback").textContent = message;
  index++;
  render();
}

$("skipBtn").addEventListener("click", () => {
  advance("Passed on this sample profile. Your next discovery is ready.");
});

$("likeBtn").addEventListener("click", () => {
  advance(`Interest recorded in this local demo for ${current.name}. Real mutual matching requires registered users.`);
});

$("intentFilter").addEventListener("change", () => {
  index = 0;
  render();
  $("feedback").textContent =
    "Showing profiles for your selected intention.";
});

$("year").textContent = new Date().getFullYear();

render();
checkExistingLogin();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => console.log("Service worker:", error));
  });
}
