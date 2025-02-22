const baseUrl = "https://kodekloud.com";
const wistiaIframeBaseUrl = "https://fast.wistia.net/embed/iframe/";
const places = (i) => i.toString().length;
const getNumber = (index) => "0".repeat(Math.max(0, places(countLectures) - places(index))) + index.toString();
const countLectures = $("li.section-item").length;
const countVideos = $("li.section-item use[*|href='#icon__Video']").length;
const courseName = $("h2").first().text();

let courseLinks = [];
let countVideoParsed = 0;
let parseCompleted = false;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // console.log("onMessage", request, "sender", sender);
  if (!parseCompleted) {
    createAlert("Not completed yet. Please try again later!");
    return;
  }

  if (request.selection === "html") {
    const htmlContent = createHtmlForDownload();
    downloadFileFromText($(".course-sidebar h2").text().toString() + ".html", htmlContent);
  } else if (request.selection === "text") {
    const textContent = createTextForDownload();
    downloadFileFromText($(".course-sidebar h2").text().toString() + ".txt", textContent);
  } else if (request.selection === "script") {
    const scriptContent = createScriptForDownload();
    downloadFileFromText($(".course-sidebar h2").text().toString() + ".sh", scriptContent);
  } else if (request.selection === "log") {
    const textContent = createTextForDownload();
    console.log(textContent);
  }
});

// Look for lesson item [li with section item]
$("li.section-item")
  .each(function (index, el) {
    // console.log("#", index, el);
    let self = $(this);
    let courseSection = self.parents(".course-section");
    let sectionTitle = $(courseSection).find(".section-title").text().trim();
    let lectureName = self.find(".lecture-name").text().trim();
    let lectureTitle = lectureName.replace(/(\r\n|\n|\r)/gm, "").replace(/(\s{2,})/gm, "");
    let number = getNumber(index + 1);

    let fullTitle = `${number}~${sectionTitle}~${lectureTitle}`;

    let lecture = {
      id: number,
      section: sectionTitle,
      name: "",
      title: lectureTitle,
      fullTitle: fullTitle,
      url: "",
      link: "",
    };

    //console.log(lecture);
    if ($(this).find("use[*|href='#icon__Video']").length > 0) {
      var url = this.dataset.lectureUrl;
      url = url ? baseUrl + url : $(this).find("a")[0].href;
      if (url) {
        // console.log("--> get download link", number);
        arrangeDownloadLinks(number, url);
      }
    }

    courseLinks.push(lecture);
  });

// Add and find video lecture item into List of All lectures
function addLectureToList(id, { name, url, link }) {
  let item = courseLinks.find((item) => item.id === id);
  item.url = url;
  item.link = link;
  item.name = name;
  countVideoParsed++;
  //console.log(countVideoParsed, item);
  createAlert(
    `Parsed video ${name}. It is ${countVideoParsed} from ${countVideos}`
  );

  if (countVideoParsed === countVideos) {
    console.log("Parsing completed. Total videos: ", countVideos);
    createAlert(`Parsing completed. Total videos: ${countVideos}`);
    parseCompleted = true;
  }
}

function arrangeDownloadLinks(index, url) {
  getLectureInfo(url, function (id, title) {
    getVideoUrl(wistiaIframeBaseUrl + id, function (url) {
      const lessonItemHyperlink = `<a href="${url}" title="${title}">${index} ${title}</a>`;
      addLectureToList(index, { name: title, url: url, link: lessonItemHyperlink });
    });
  });
}

function getLectureInfo(page, cb) {
  $.get(page, function (data) {
    var wistiaId = $(data).find("div.attachment-wistia-player").attr("data-wistia-id");
    var videoTitle = $(data).find("#lecture_heading").text().toString().trim();

    cb(wistiaId, videoTitle);
  });
}

function getVideoUrl(wistiaPage, cb) {
  $.get(wistiaPage, function (pageSource) {
    var regex = /wistia.com\/deliveries\/(?:[a-zA-Z0-9]+)\.bin/gm;
    var result = regex.exec(pageSource.toString()).toString();
    result = "http://embed." + result.replace("bin", "mp4");
    cb(result);
  });
}

function createTextForDownload() {
  let textContent = ``;
  courseLinks.forEach((item) => {
    if (item.name !== "") {
      let row = `${item.id}--${item.name}: ${item.url} \r\n`;
      textContent += row;
    }
  });
  return textContent;
}

function createHtmlForDownload() {
  let htmlContent = `<!doctype html> \r\n<html lang="en"><head> <meta charset="utf-8"> \r\n
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"> \r\n
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" /> \r\n
      </head><body>\r\n
      <div class="container">\r\n
      <table class='table table-striped table-bordered'>\r\n
      <thead><td>No</td><td>Section</td><td>Name</td><td>Title</td><td>Video link</td></thead>\r\n
      <tbody>`;
  courseLinks.forEach((item) => {
    let row = `<tr><td>${item.id}</td><td>${item.section}</td><td>${item.title}</td><td>${item.fullTitle}</td><td>${item.link}</td></tr>\r\n`;
    htmlContent += row;
  });
  htmlContent += `</tbody></table>\r\n</div></body></html>`;

  return htmlContent;
}

function createScriptForDownload() {
  let scriptContent = `#!/bin/bash\n# begin of downloading script for course ${courseName}\n`;
  scriptContent += 'mkdir -p "' + sanitize(courseName) + '"\n';
  scriptContent += 'cd "' + sanitize(courseName) + '"\n';
  courseLinks.forEach((item) => {
    if (item.name !== "") {
      const sanitized = sanitize(`${item.id}-${item.section}-${item.name}.mp4`);
      const row = `youtube-dl -c -o "${sanitized}" "${item.url}"\n`;
      scriptContent += row;
    }
  });
  scriptContent += "cd ..\n";
  scriptContent += `# end of downloading script for course ${courseName}\n`;
  return scriptContent;
}

function createAlert(message) {
  const alertDiv =
    `<div class='message' 
              style='position: absolute; top: 10px; right: 10px; z-index: 5000; 
                  padding: 10px; width: 400px; min-height: 50px; height: 50px;
                  color: #fff; background-color: #1e90ff'>` +
    message +
    `<div style='cursor: pointer; float:right; margin-right: 10px' class='close-alert'>&#10005;</div>
      </div>
      <script>
        $("body").on("click", ".close-alert", function(e) {
          $(".message").remove();
          e.preventDefault();
        });
      </script>
      `;

  $(".message").remove();
  $("body").prepend(alertDiv);
}

function downloadFileFromText(filename, content) {
  let anchor = document.createElement("a");
  const dataBytes = new TextEncoder().encode(content);
  const blob = new Blob([dataBytes], {
    type: "text/plain;charset=utf-8", // "application/json;charset=utf-8"
  });

  anchor.href = window.URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click(); //this is probably the key - simulating a click on a download link
  anchor.remove(); // we don't need this anymore
}
