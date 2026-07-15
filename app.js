let startTime, updatedTime, difference = 0, tInterval;
let running = false, laps = [], format = "ms", soundOn = false, autoSave = false;

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startPause() {
  if (!running) {
    startTime = new Date().getTime() - difference;
    tInterval = setInterval(update, 10);
    running = true;
  } else {
    clearInterval(tInterval);
    running = false;
  }
}

function reset() {
  clearInterval(tInterval);
  document.getElementById("time").innerHTML = "00:00:000";
  laps = [];
  document.getElementById("laps").innerHTML = "";
  running = false;
  difference = 0;
}

function update() {
  updatedTime = new Date().getTime();
  difference = updatedTime - startTime;
  let hrs = Math.floor(difference / (1000 * 60 * 60));
  let mins = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  let secs = Math.floor((difference % (1000 * 60)) / 1000);
  let ms = Math.floor(difference % 1000);

  if (format === "hms") {
    document.getElementById("time").innerHTML =
      (hrs < 10 ? "0" : "") + hrs + ":" +
      (mins < 10 ? "0" : "") + mins + ":" +
      (secs < 10 ? "0" : "") + secs + ":" +
      (ms < 100 ? (ms < 10 ? "00" : "0") : "") + ms;
  } else {
    document.getElementById("time").innerHTML =
      (mins < 10 ? "0" : "") + mins + ":" +
      (secs < 10 ? "0" : "") + secs + ":" +
      (ms < 100 ? (ms < 10 ? "00" : "0") : "") + ms;
  }
}

function lap() {
  let current = document.getElementById("time").innerHTML;
  laps.push(current);
  document.getElementById("laps").innerHTML = laps
    .map((l,i)=>`Lap ${i+1}: ${l}`)
    .join("<br>");
  if (soundOn) beep();
}

function setFormat(val) { format = val; }
function toggleSound() { soundOn = document.getElementById("sound").checked; }
function toggleAutoSave() { autoSave = document.getElementById("autosave").checked; }

function beep() {
  new Audio("beep.mp3").play();
}

// T9 keypad support
document.addEventListener("keydown", function(e) {
  switch(e.key) {
    case "1": reset(); break;
    case "5": startPause(); break;
    case "0": lap(); break;
    case "*": showPage("settings"); break;
  }
});
