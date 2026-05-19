window.addEventListener("load", function () {

  let currentPageInfo;
  let totalPageCount;
  let isAnimating = false;
  let currentLanguage = "mi";


  function turnLeftClick() {
    let pageLeft = document.querySelector("#page-left");
    let controlLeft = document.querySelector("#turn-left");
    pageLeft.addEventListener('click', previous_page);
    controlLeft.addEventListener('click', previous_page);
  }

  function turnRightClick() {
    let pageRight = document.querySelector("#page-right");
    let controlRight = document.querySelector("#turn-right"); 

    pageRight.addEventListener('click', next_page);
    controlRight.addEventListener('click', next_page);
  }


  turnLeftClick();
  turnRightClick();
  initialisePage();

  async function initialisePage() {

    let response = await fetch(`api/index.json`);
    let pageJsonObject = await response.json();

    totalPageCount = pageJsonObject.length;
    populatePageDropdown(pageJsonObject)

    await loadPage(pageJsonObject[0]);
  }

  async function loadPage(pageUrlToFetch) {
    let response = await fetch(pageUrlToFetch);

    currentPageInfo = await response.json();

    updatePageDisplay();
  }

  function updatePageDisplay() {
    document.querySelector("#total-page").innerText = totalPageCount;

    document.querySelector("#current-page").innerText = currentPageInfo.page_number;

    let rightPageDiv = document.querySelector("#page-right");
    rightPageDiv.innerHTML = currentPageInfo.content[currentLanguage];

    let leftPageDiv = document.querySelector("#page-left");
leftPageDiv.innerHTML = "";

if (currentPageInfo.image.endsWith(".mp4")) {

  const video = document.createElement("video");
  video.src = currentPageInfo.image;
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  video.style.width = "100%";
  video.style.height = "100%";
  
video.style.objectFit = "contain";
// video.style.backgroundColor = "black"; 


  leftPageDiv.appendChild(video);

} else {

  // fallback kalau masih gambar
  const imgElement = document.createElement("img");
  imgElement.src = currentPageInfo.image;

  leftPageDiv.appendChild(imgElement);
}

    updateCursor();

    // Notify sprite that the page has changed
    document.dispatchEvent(new CustomEvent("sprite:pageChanged", {
      detail: {
        pageNumber: currentPageInfo.page_number,
        totalPages: totalPageCount,
      }
    }));

    document.querySelector("#page-select").selectedIndex =
    currentPageInfo.page_number - 1;

    enableWordFeatures();
  }

  function enableWordFeatures() {
  const words = document.querySelectorAll(".word");

  words.forEach(word => {
    word.addEventListener("click", (event) => {
      event.stopPropagation();

      const text = word.textContent.trim();

      const utterance = new SpeechSynthesisUtterance(text);

      if (currentLanguage === "mi") {
        utterance.lang = "mi-NZ";
      } else {
        utterance.lang = "en-US";
      }

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  });
}
  function previous_page() {
    if (currentPageInfo.previous_page) {
      animateAndLoad("prev");
    }
  }

  function next_page() {
    if (currentPageInfo.next_page) {
      animateAndLoad("next");
    }
  }

  function animateAndLoad(direction) {
    if (isAnimating) return;

    const leftPage = document.querySelector("#page-left");
    const rightPage = document.querySelector("#page-right");

    if (direction === "next" && currentPageInfo.next_page) {
        isAnimating = true;
        rightPage.classList.add("page-flip-next");
        
        setTimeout(() => {
            loadPage(currentPageInfo.next_page);
        }, 400); 

        setTimeout(() => {
            rightPage.classList.remove("page-flip-next");
            isAnimating = false; // Reset flag
        }, 800);
        
    } else if (direction === "prev" && currentPageInfo.previous_page) {
        isAnimating = true;
        leftPage.classList.add("page-flip-prev");
        
        setTimeout(() => {
            loadPage(currentPageInfo.previous_page);
        }, 400);

        setTimeout(() => {
            leftPage.classList.remove("page-flip-prev");
            isAnimating = false; // Reset flag
        }, 800);
    }
}

function updateCursor() {
  const leftPage = document.querySelector("#page-left");
  const rightPage = document.querySelector("#page-right");

  const page = currentPageInfo.page_number;

  // Reset
  leftPage.style.cursor = "auto";
  rightPage.style.cursor = "auto";

  // Page 1 only right
  if (page === 1) {
    rightPage.style.cursor = "e-resize";
  }

  // last page only left
  else if (page === totalPageCount) {
    leftPage.style.cursor = "w-resize";
  }

  else {
    leftPage.style.cursor = "w-resize";
    rightPage.style.cursor = "e-resize";
  }
}

function populatePageDropdown(pages) {
  const select = document.querySelector("#page-select");

  select.innerHTML = "";

  pages.forEach((pageUrl, index) => {
    const option = document.createElement("option");
    option.value = pageUrl;
    option.textContent = `Page ${index + 1}`;
    select.appendChild(option);
  });

  
  select.addEventListener("change", (e) => {
    loadPage(e.target.value);
  });
}

document.querySelector("#language-toggle").addEventListener("change", (e) => {
  currentLanguage = e.target.value;
  updatePageDisplay();
});

function initPuzzle() {
  const overlay = document.getElementById("puzzle-overlay");
  const bank = document.getElementById("word-bank");
  const zone = document.getElementById("drop-zone");
  const checkBtn = document.getElementById("check-btn");
  const skipBtn = document.getElementById("skip-btn");
  const feedback = document.getElementById("puzzle-feedback");

  const correctSentence = ["Te", "Tahi-o-Te-Rā", "is", "the", "guardian"];

  const shuffled = [...correctSentence].sort(() => Math.random() - 0.5);

  shuffled.forEach(word => {
    const span = document.createElement("div");
    span.className = "puzzle-word";
    span.innerText = word;

    span.addEventListener("click", () => {
      zone.appendChild(span);
    });

    bank.appendChild(span);
  });

  zone.addEventListener("click", (e) => {
    if (e.target.classList.contains("puzzle-word")) {
      bank.appendChild(e.target);
    }
  });

  checkBtn.addEventListener("click", () => {
    const userAnswer = [...zone.children].map(el => el.innerText);

    if (JSON.stringify(userAnswer) === JSON.stringify(correctSentence)) {
      feedback.innerText = "✅ Correct!";
      feedback.style.color = "green";

      setTimeout(() => {
        overlay.style.display = "none";
      }, 800);
    } else {
      feedback.innerText = "❌ Try again!";
      feedback.style.color = "red";
    }
  });

  skipBtn.addEventListener("click", () => {
    overlay.style.display = "none";
  });
}




setTimeout(() => {
  initPuzzle();
}, 100);

});
