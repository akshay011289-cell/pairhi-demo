
const SUPABASE_URL = "https://nckkelnaxivmynmsktoa.supabase.co";

const SUPABASE_KEY = "YOUR_ACTUAL_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log("PairHi Supabase connection initialized");

const testBox = document.createElement("div");
testBox.style.cssText =
  "position:fixed;bottom:10px;left:10px;right:10px;padding:12px;background:white;border:2px solid #8f3658;border-radius:12px;z-index:99999;text-align:center;color:#29232a;font-size:13px";

testBox.textContent = "PairHi: Testing Supabase...";
document.body.appendChild(testBox);

supabaseClient.from("profiles").select("id").limit(1)
  .then(({ data, error }) => {
    testBox.textContent = error
      ? "Supabase database error: " + error.message
      : "SUCCESS! PairHi connected to Supabase.";
  })
  .catch(error => {
    testBox.textContent = "Connection failed: " + error.message;
  });
const profiles = [
 {name:"Aarohi",age:28,city:"Delhi",intent:"Marriage",bio:"I value kindness, family, honest communication and building a life with shared purpose. I enjoy books, travel and trying new food.",tags:["Family-oriented","Travel","Reading"],score:"Strong values overlap",photo:"linear-gradient(140deg,#d8a6a5,#92566b)"},
 {name:"Rohan",age:30,city:"Jaipur",intent:"Long-term relationship",bio:"Grounded, curious and close to my family. Looking for a respectful partnership where both people grow together.",tags:["Entrepreneurship","Fitness","Culture"],score:"Good potential",photo:"linear-gradient(140deg,#c5a18b,#805e52)"},
 {name:"Meera",age:27,city:"Pune",intent:"Marriage",bio:"A thoughtful person who loves music, meaningful conversations and weekend nature escapes. Honesty matters most to me.",tags:["Music","Nature","Family"],score:"Strong values overlap",photo:"linear-gradient(140deg,#d6a7b8,#a45e7d)"},
 {name:"Kabir",age:31,city:"Mumbai",intent:"Long-term relationship",bio:"I believe a strong relationship is built on friendship, trust and laughter. Hoping to meet someone intentional and kind.",tags:["Design","Cooking","Films"],score:"Good potential",photo:"linear-gradient(140deg,#c4a88b,#715e55)"}
];
let pool=[...profiles], current=null, index=0;
const $=id=>document.getElementById(id);
function render(){
 const filter=$("intentFilter").value;
 const visible=profiles.filter(p=>filter==="all"||p.intent===filter);
 if(!visible.length){$("feedback").textContent="No sample profiles in this category.";return;}
 current=visible[index%visible.length];
 $("personName").textContent=`${current.name}, ${current.age}`;
 $("personLocation").textContent=`${current.city} · India`;
 $("personIntent").textContent=current.intent;
 $("personBio").textContent=current.bio;
 $("personTags").innerHTML=current.tags.map(t=>`<span>${t}</span>`).join("");
 $("compatScore").textContent=current.score;
 $("photo").style.background=current.photo;
 $("photoNumber").textContent=`${(index%visible.length)+1} / ${visible.length}`;
}
function advance(message){$("feedback").textContent=message;index++;render();}
$("skipBtn").addEventListener("click",()=>advance("Passed on this sample profile. Your next discovery is ready."));
$("likeBtn").addEventListener("click",()=>advance(`Interest recorded in this local demo for ${current.name}. Real mutual matching requires registered users and a connected backend.`));
$("intentFilter").addEventListener("change",()=>{index=0;render();$("feedback").textContent="Showing profiles for your selected intention.";});
$("profileBtn").addEventListener("click",()=>$("profileDialog").showModal());
$("year").textContent=new Date().getFullYear();
render();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
