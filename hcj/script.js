// 全局變數宣告
let htmlEditor, cssEditor, jsEditor
let versions = []
let isEditingVersionName = false
const cssEditorRefreshed = false
const jsEditorRefreshed = false

// 確保 CodeMirror 已載入後再執行初始化
document.addEventListener("DOMContentLoaded", () => {
  // 檢查 CodeMirror 是否已載入
  if (typeof CodeMirror === "undefined") {
    console.error("CodeMirror 庫未載入，請確認 HTML 中的腳本標籤順序")
    return
  }

  const editorsContainer = document.getElementById("editors-container")
  const outputFrame = document.getElementById("output-frame")
  const consoleOutput = document.getElementById("console-output")

  const themes = {
    dark: "monokai",
    light: "default",
  }
  let currentTheme = "light"

  const themeToggleBtn = document.querySelector(".theme-toggle-btn")
  themeToggleBtn.addEventListener("click", toggleTheme)

  function toggleTheme() {
    currentTheme = currentTheme === "light" ? "dark" : "light"
    const newTheme = themes[currentTheme]
    ;[htmlEditor, cssEditor, jsEditor].forEach((editor) => {
      editor.setOption("theme", newTheme)
    })

    themeToggleBtn.textContent = currentTheme === "light" ? "◑" : "◐"
  }

  const foldOptions = {
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    lineNumbers: true,
    lineWrapping: true,
  }

  // 初始化 CodeMirror 編輯器
  htmlEditor = CodeMirror.fromTextArea(document.getElementById("html-editor"), {
    mode: "htmlmixed",
    theme: "default",
    ...foldOptions,
    extraKeys: {
      "Ctrl-Q": (cm) => {
        cm.foldCode(cm.getCursor())
      },
    },
  })

  cssEditor = CodeMirror.fromTextArea(document.getElementById("css-editor"), {
    mode: "css",
    theme: "default",
    ...foldOptions,
    extraKeys: {
      "Ctrl-Q": (cm) => {
        cm.foldCode(cm.getCursor())
      },
    },
  })

  jsEditor = CodeMirror.fromTextArea(document.getElementById("js-editor"), {
    mode: "javascript",
    theme: "default",
    ...foldOptions,
    extraKeys: {
      "Ctrl-Q": (cm) => {
        cm.foldCode(cm.getCursor())
      },
    },
  })

  htmlEditor.refresh()
  cssEditor.refresh()
  jsEditor.refresh()

  // 加載保存的版本
  versions = loadVersions()

  const versionsBtn = document.getElementById("versions-btn")
  const versionsPanel = document.getElementById("versions-panel")
  const closeVersionsBtn = document.getElementById("close-versions")
  const versionsList = document.getElementById("versions-list")
  const saveVersionBtn = document.getElementById("save-version")
  const deleteAllVersionsBtn = document.getElementById("delete-all-versions")

  function adjustGutterWidth(editor) {
    const lineCount = editor.lineCount()
    const lineCountWidth = String(lineCount).length
    const gutterWidth = 10 + lineCountWidth * 8 // 假設每個字符寬 8px
    editor.getGutterElement().style.width = gutterWidth + "px"
  }

  adjustGutterWidth(cssEditor)
  adjustGutterWidth(jsEditor)

  // 在內容變化時重新調整
  cssEditor.on("change", () => adjustGutterWidth(cssEditor))
  jsEditor.on("change", () => adjustGutterWidth(jsEditor))

  // 初始化版本列表
  updateVersionsList()

  closeVersionsBtn.addEventListener("click", () => {
    versionsPanel.classList.remove("open")
  })

  // 刪除所有版本
  deleteAllVersionsBtn.addEventListener("click", () => {
    if (confirm("確定要刪除所有版本嗎？")) {
      versions = []
      saveVersions()
      updateVersionsList()
    }
  })

  // 更新 updateVersionsList 函數
  function updateVersionsList() {
    versionsList.innerHTML = ""
    versions.forEach((version, index) => {
      const versionItem = document.createElement("div")
      versionItem.className = "version-item"
      versionItem.innerHTML = `
                <div>
                    <button class="viewOutput-btn" title="預覽">預覽</button>
                    <button class="viewCode-btn">代碼</button>
					<button class="share-btn">分享</button><br />
                    <button class="restore-btn">還原</button>                    
                    <button class="download-btn">下載</button>
                    <button class="delete-btn">刪除</button>
                </div>
                <span class="version-name" data-index="${index}">
                    ${version.name || `版本 ${index + 1}`} (${version.timestamp})
                </span>
            `

      versionItem.querySelector(".restore-btn").addEventListener("click", () => restoreVersion(index))
      versionItem.querySelector(".delete-btn").addEventListener("click", () => deleteVersion(index))
      versionItem.querySelector(".download-btn").addEventListener("click", () => downloadVersion(index))
      versionItem.querySelector(".viewOutput-btn").addEventListener("click", () => viewOutputVersion(index))
      versionItem.querySelector(".viewCode-btn").addEventListener("click", () => viewCodeVersion(index))
      versionItem.querySelector(".share-btn").addEventListener("click", () => shareVersion(index))

      const versionNameSpan = versionItem.querySelector(".version-name")
      versionNameSpan.addEventListener("dblclick", (e) => editVersionName(e, index))

      versionsList.insertBefore(versionItem, versionsList.firstChild)
    })
  }

  function shareVersion(index) {
    const version = versions[index]

    // 移除註解、空行和多餘的空格
    const cleanHTML = version.html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/(\n)\s+/g, "$1")
      .replace(/\s+(\n)\s+/g, "")
      .replace(/>\s+</g, "><")
      .replace(/\s*([<>])\s*/g, "$1")
      .replace(/\n+/g, "")
      .trim()
    const cleanCSS = version.css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(\n)\s+/g, "$1")
      .replace(/\s+(\n)\s+/g, "")
      .replace(/\s*([:;{}])\s*/g, "$1")
      .replace(/^\s+|\s+$/g, "")
      .replace(/\n+/g, "")
      .trim()
    const cleanJS = version.js
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(\n)\s+/g, "$1")
      .replace(/\s+(\n)\s+/g, "")
      .replace(/\s*([=:+\-*/<>{}()[\],;])\s*/g, "$1")
      .replace(/^\s+|\s+$/g, "")
      .replace(/\n+/g, "")
      .trim()

    // 編碼並創建 URL 參數
    const params = new URLSearchParams({
      h: btoa(encodeURIComponent(cleanHTML)),
      c: btoa(encodeURIComponent(cleanCSS)),
      j: btoa(encodeURIComponent(cleanJS)),
      v: "x",
    })

    // 獲取當前 URL 並添加參數
    const shareURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`

    tinyurl(shareURL)
  }

  // 還原版本
  function restoreVersion(index) {
    if (confirm("確定要還原到此版本嗎？當前未保存的更改將會丟失。")) {
      const version = versions[index]
      htmlEditor.setValue(version.html)
      cssEditor.setValue(version.css)
      jsEditor.setValue(version.js)
      updateOutput()
    }
  }

  // 刪除單個版本
  function deleteVersion(index) {
    if (confirm("確定要刪除此版本嗎？")) {
      versions.splice(index, 1)
      saveVersions()
      updateVersionsList()
    }
  }

  // 匯出單個版本
  function downloadVersion(index) {
    const version = versions[index]
    let timeText = version.timestamp
    timeText = timeText.replace(/\//g, "").replace(/:/g, "").replace(/ /g, "-")

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <style>
        ${version.css}
    </style>
</head>
<body>
    ${version.html}
    <script>
        ${version.js}
    </script>
</body>
</html>`

    // 創建一個 Blob 物件
    const blob = new Blob([htmlContent], {
      type: "text/html;charset=utf-8",
    })

    // 創建一個下載鏈接
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "" + timeText + ".html"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // 釋放 URL 物件
    setTimeout(() => {
      URL.revokeObjectURL(link.href)
    }, 100)
  }

  function viewOutputVersion(index) {
    const version = versions[index]
    const previewPanel = document.querySelector(".preview-panel")

    previewPanel.innerHTML = ""

    // 創建一個 iframe 來顯示結果
    const iframe = document.createElement("iframe")
    iframe.style.width = "100%"
    iframe.style.height = "100%"
    iframe.style.border = "none"

    previewPanel.appendChild(iframe)

    const content = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>${version.css}</style>
                </head>
                <body>
                    ${version.html}
                    <script>${version.js}<\/script>
                </body>
            </html>
        `

    iframe.srcdoc = content
  }

  function viewCodeVersion(index) {
    const version = versions[index]
    const previewPanel = document.querySelector(".preview-panel")

    previewPanel.innerHTML = ""

    const codeContainer = document.createElement("div")
    codeContainer.style.display = "flex"
    codeContainer.style.flexDirection = "column"
    codeContainer.style.height = "100%"
    codeContainer.style.overflow = "auto"

    const sections = [
      {
        title: "HTML",
        content: version.html,
        mode: "htmlmixed",
      },
      {
        title: "CSS",
        content: version.css,
        mode: "css",
      },
      {
        title: "JavaScript",
        content: version.js,
        mode: "javascript",
      },
    ]

    sections.forEach((section) => {
      const sectionElement = document.createElement("div")
      sectionElement.style.marginBottom = "20px"

      const titleElement = document.createElement("h3")
      titleElement.textContent = section.title
      titleElement.style.marginBottom = "10px"

      const codeElement = document.createElement("div")
      codeElement.style.border = "1px solid #ddd"
      codeElement.style.borderRadius = "4px"
      codeElement.style.padding = "10px"

      sectionElement.appendChild(titleElement)
      sectionElement.appendChild(codeElement)
      codeContainer.appendChild(sectionElement)

      // 使用 setTimeout 確保 DOM 已經渲染
      setTimeout(() => {
        const cm = CodeMirror(codeElement, {
          value: section.content,
          mode: section.mode,
          theme: "default",
          lineNumbers: true,
          readOnly: true,
          viewportMargin: Number.POSITIVE_INFINITY,
        })

        cm.setOption("extraKeys", {
          Tab: (cm) => {
            var spaces = Array(cm.getOption("indentUnit") + 1).join(" ")
            cm.replaceSelection(spaces)
          },
        })
        cm.setOption("indentUnit", 4)
        cm.setOption("tabSize", 4)
        cm.setOption("indentWithTabs", false)

        cm.getWrapperElement().style.fontSize = "14px"
        cm.refresh()
      }, 0)
    })

    previewPanel.appendChild(codeContainer)
  }

  function editVersionName(event, index) {
    if (isEditingVersionName) return
    isEditingVersionName = true

    const span = event.target
    const currentName = versions[index].name || `版本 ${index + 1}`
    const input = document.createElement("input")
    input.type = "text"
    input.value = currentName
    input.className = "version-name-input"

    span.innerHTML = ""
    span.appendChild(input)
    input.focus()

    function handleFinishEditing() {
      if (input.parentNode === span) {
        finishEditing(span, input, index)
      }
    }

    input.addEventListener("blur", handleFinishEditing)

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleFinishEditing()
      }
    })
  }

  function finishEditing(span, input, index) {
    if (!isEditingVersionName) return

    const newName = input.value.trim()
    versions[index].name = newName || null

    span.textContent = `${versions[index].name || `版本 ${index + 1}`} (${versions[index].timestamp})`

    isEditingVersionName = false
    saveVersions()
  }

  // 修改 saveVersionBtn 的事件監聽器
  saveVersionBtn.addEventListener("click", () => {
    const now = new Date()
    const timestamp = now
      .toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/(\d+)\/(\d+), (\d+):(\d+)/, "$1$2 $3:$4")

    const currentVersion = {
      html: htmlEditor.getValue(),
      css: cssEditor.getValue(),
      js: jsEditor.getValue(),
      timestamp: timestamp,
      name: null,
    }
    versions.push(currentVersion)
    saveVersions()
    updateVersionsList()
  })

  function saveVersions() {
    localStorage.setItem("editorVersions", JSON.stringify(versions))
  }

  function loadVersions() {
    const savedVersions = localStorage.getItem("editorVersions")
    return savedVersions ? JSON.parse(savedVersions) : []
  }

  // 獲取當前活動的編輯器
  function getActiveEditor() {
    if (document.querySelector("#html").classList.contains("active")) {
      return htmlEditor
    } else if (document.querySelector("#css").classList.contains("active")) {
      return cssEditor
    } else if (document.querySelector("#js").classList.contains("active")) {
      return jsEditor
    }
    return null
  }

  // 清除按鈕
  document.querySelector(".clear-btn").addEventListener("click", () => {
    const activeEditor = getActiveEditor()
    if (activeEditor) {
      activeEditor.setValue("")
    } else if (document.querySelector("#console").classList.contains("active")) {
      consoleOutput.innerHTML = ""
    }
  })

  // 複製按鈕
  document.querySelector(".copy-btn").addEventListener("click", () => {
    const activeEditor = getActiveEditor()
    let content = ""
    if (activeEditor) {
      content = activeEditor.getValue()
    } else if (document.querySelector("#console").classList.contains("active")) {
      content = consoleOutput.innerText
    }
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        alert("已複製到剪貼簿")
      })
    }
  })

  // 下載按鈕
  document.querySelector(".download-btn").addEventListener("click", () => {
    const activeEditor = getActiveEditor()
    if (activeEditor) {
      let defaultFileName = "file.txt"
      let mimeType = "text/plain"

      if (activeEditor === htmlEditor) {
        defaultFileName = "index.html"
        mimeType = "text/html"
      } else if (activeEditor === cssEditor) {
        defaultFileName = "style.css"
        mimeType = "text/css"
      } else if (activeEditor === jsEditor) {
        defaultFileName = "script.js"
        mimeType = "text/javascript"
      }

      // 提示用戶輸入檔名，預設為對應的檔名
      const fileName = prompt("請輸入要保存的檔名:", defaultFileName)

      // 如果用戶取消或未輸入檔名，則不執行下載
      if (!fileName) return

      const content = activeEditor.getValue()
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 釋放 URL 物件
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 100)
    }
  })

  document.querySelector(".beautiful-btn").addEventListener("click", () => {
    const activeEditor = getActiveEditor()
    if (activeEditor) {
      const mode = activeEditor === htmlEditor ? "html" : activeEditor === cssEditor ? "css" : "javascript"

      const selectedText = activeEditor.getSelection()
      const isSelection = selectedText.length > 0
      const textToBeautify = isSelection ? selectedText : activeEditor.getValue()

      let beautifiedText = ""
      try {
        if (mode === "html" && typeof html_beautify === "function") {
          beautifiedText = html_beautify(textToBeautify, {
            indent_size: 2,
            wrap_line_length: 80,
            preserve_newlines: true,
          })
        } else if (mode === "css" && typeof css_beautify === "function") {
          beautifiedText = css_beautify(textToBeautify, {
            indent_size: 2,
            wrap_line_length: 80,
          })
        } else if (mode === "javascript" && typeof js_beautify === "function") {
          beautifiedText = js_beautify(textToBeautify, {
            indent_size: 2,
            wrap_line_length: 80,
          })
        } else {
          console.warn("美化函數未定義，請確認 js-beautify 庫已正確載入")
          return
        }

        if (isSelection) {
          activeEditor.replaceSelection(beautifiedText)
        } else {
          activeEditor.setValue(beautifiedText)
        }
      } catch (error) {
        console.error("美化代碼時發生錯誤:", error)
        alert("美化代碼時發生錯誤，請檢查控制台獲取詳細信息")
      }
    }
  })

  // 拆分按鈕
  document.querySelector(".divide-btn").addEventListener("click", () => {
    if (document.querySelector("#html").classList.contains("active")) {
      const htmlContent = htmlEditor.getValue()

      // 提取CSS
      let cssContent = cssEditor.getValue()
      const styleRegex = /<style>([\s\S]*?)<\/style>/gi
      let styleMatch
      while ((styleMatch = styleRegex.exec(htmlContent)) !== null) {
        cssContent += styleMatch[1] + "\n"
      }

      // 提取JavaScript
      let jsContent = jsEditor.getValue()
      const scriptRegex = /<script>([\s\S]*?)<\/script>/gi
      let scriptMatch
      while ((scriptMatch = scriptRegex.exec(htmlContent)) !== null) {
        jsContent += scriptMatch[1] + "\n"
      }

      // 移除HTML中的style和script標籤
      let newHtmlContent = htmlContent.replace(/<style>[\s\S]*?<\/style>/gi, "")
      newHtmlContent = newHtmlContent.replace(/<script>[\s\S]*?<\/script>/gi, "")

      // 更新各編輯器的內容
      htmlEditor.setValue(newHtmlContent.trim())
      cssEditor.setValue(cssContent.trim())
      jsEditor.setValue(jsContent.trim())

      // 更新輸出
      updateOutput()
    }
  })

  document.querySelector(".combine-btn").addEventListener("click", () => {
    // 獲取當前HTML、CSS和JavaScript的內容
    let htmlContent = htmlEditor.getValue()
    const cssContent = cssEditor.getValue()
    const jsContent = jsEditor.getValue()

    // 檢查並添加必要的HTML結構和元素
    if (!/<html/i.test(htmlContent)) {
      htmlContent = `<html lang="zh-TW">\n<head>\n</head>\n<body>\n${htmlContent}\n</body>\n</html>`
    } else {
      // 如果已經有 <html> 標籤，但沒有 lang 屬性
      if (!/<html[^>]*lang=/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/<html([^>]*)>/i, '<html$1 lang="zh-TW">')
      }

      // 確保有 <head> 和 <body> 標籤
      if (!/<head>/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/<html([^>]*)>/i, "<html$1>\n<head>\n</head>")
      }
      if (!/<body>/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/<\/head>/i, "</head>\n<body>") + "\n</body>"
      }
    }

    // 在 <head> 中添加必要的元素
    let headContent = ""
    if (!/<meta[^>]*charset=/i.test(htmlContent)) {
      headContent += '<meta charset="UTF-8">\n'
    }
    if (!/<meta[^>]*name="viewport"/i.test(htmlContent)) {
      headContent += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    }
    if (!/<title>/i.test(htmlContent)) {
      headContent += '<title>✨ 烏衣行</title>\n<link rel="stylesheet" href="styles.css">'
    }

    if (headContent) {
      htmlContent = htmlContent.replace(/<\/head>/i, headContent + "</head>")
    }

    // 添加 CSS
    if (cssContent.trim() !== "") {
      const styleTag = `<style>\n${cssContent}\n</style>`
      htmlContent = htmlContent.replace(/<\/head>/i, styleTag + "\n</head>")
    }

    // 添加 JavaScript
    if (jsContent.trim() !== "") {
      const scriptTag = `<script>\n${jsContent}\n</script>`
      htmlContent = htmlContent.replace(/<\/body>/i, scriptTag + '\n<script src="script.js"></script>\n</body>')
    }

    // 更新 HTML 編輯器的內容
    htmlEditor.setValue(htmlContent)

    // 清空 CSS 和 JavaScript 編輯器
    cssEditor.setValue("")
    jsEditor.setValue("")

    // 更新輸出
    updateOutput()
  })

  // 插入文字下拉選單
  document.querySelector(".insert-text-dropdown").addEventListener("change", function () {
    const selectedText = this.value
    if (!selectedText) return

    const activeEditor = getActiveEditor()
    if (activeEditor) {
      const doc = activeEditor.getDoc()
      const cursor = doc.getCursor()
      doc.replaceRange(selectedText, cursor)
    }

    this.value = ""
  })

  const maxHistoryLength = 100 // 設定歷史記錄的最大長度

  const editors = {
    html: {
      element: htmlEditor,
      history: [],
      currentIndex: -1,
    },
    css: {
      element: cssEditor,
      history: [],
      currentIndex: -1,
    },
    js: {
      element: jsEditor,
      history: [],
      currentIndex: -1,
    },
  }

  function updateHistory(editorName) {
    const editor = editors[editorName]
    const currentContent = editor.element.getValue()

    // 如果內容有變化，添加到歷史記錄
    if (editor.currentIndex === -1 || currentContent !== editor.history[editor.currentIndex]) {
      editor.currentIndex++
      editor.history.splice(editor.currentIndex)
      editor.history.push(currentContent)

      if (editor.history.length > maxHistoryLength) {
        editor.history.shift()
        editor.currentIndex--
      }

      updateUndoRedoButtons(editorName)
    }
  }

  function undo(editorName) {
    const editor = editors[editorName]
    if (editor.currentIndex > 0) {
      editor.currentIndex--
      editor.element.setValue(editor.history[editor.currentIndex])
      updateUndoRedoButtons(editorName)
      updateOutput()
    }
  }

  function redo(editorName) {
    const editor = editors[editorName]
    if (editor.currentIndex < editor.history.length - 1) {
      editor.currentIndex++
      editor.element.setValue(editor.history[editor.currentIndex])
      updateUndoRedoButtons(editorName)
      updateOutput()
    }
  }

  function updateUndoRedoButtons() {
    const activeEditor = getActiveEditor()
    if (!activeEditor) return

    const editorName = Object.keys(editors).find((name) => editors[name].element === activeEditor)
    const editor = editors[editorName]

    const undoBtn = document.querySelector(".undo-btn")
    const redoBtn = document.querySelector(".redo-btn")

    undoBtn.disabled = editor.currentIndex <= 0
    redoBtn.disabled = editor.currentIndex >= editor.history.length - 1
  }

  // 為每個編輯器添加變更事件監聽器
  Object.keys(editors).forEach((editorName) => {
    const editor = editors[editorName]
    editor.element.on("change", () => {
      updateHistory(editorName)
      updateOutput()
      updateUndoRedoButtons()
    })

    // 初始化歷史記錄
    updateHistory(editorName)
  })

  // 為還原和重做按鈕添加點擊事件
  document.querySelector(".undo-btn").addEventListener("click", () => {
    const activeEditor = getActiveEditor()
    if (activeEditor) {
      const editorName = Object.keys(editors).find((name) => editors[name].element === activeEditor)
      undo(editorName)
    }
  })

  document.querySelector(".redo-btn").addEventListener("click", () => {
    const activeEditor = getActiveEditor()
    if (activeEditor) {
      const editorName = Object.keys(editors).find((name) => editors[name].element === activeEditor)
      redo(editorName)
    }
  })

  // 頁籤切換功能
  const tabButtons = document.querySelectorAll(".tab-button")
  const tabContents = document.querySelectorAll(".editor-container, .output")
  const toolbar = document.getElementById("toolbar")

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab")

      tabButtons.forEach((btn) => btn.classList.remove("active"))
      tabContents.forEach((content) => content.classList.remove("active"))

      button.classList.add("active")

      // 檢查是否存在對應的內容元素
      const contentElement = document.getElementById(tabName)
      if (contentElement) {
        contentElement.classList.add("active")

        // 刷新相應的編輯器
        if (tabName === "css" && !cssEditorRefreshed) {
          setTimeout(() => cssEditor.refresh(), 0)
        } else if (tabName === "js" && !jsEditorRefreshed) {
          setTimeout(() => jsEditor.refresh(), 0)
        }
      }

      // 特殊處理 "versions" 標籤
      if (tabName === "versions") {
        versionsPanel.classList.toggle("open")
        document.querySelector(".preview-panel").innerHTML = ""
      } else {
        versionsPanel.classList.remove("open")
      }

      // 檢查是否需要隱藏 toolbar
      if (tabName === "console" || tabName === "output" || tabName === "versions") {
        toolbar.style.display = "none"
      } else {
        toolbar.style.display = "flex"
      }

      updateUndoRedoButtons()
    })
  })

  // 定義 updateOutput 函數
  function updateOutput() {
    const html = htmlEditor.getValue()
    const css = cssEditor.getValue()
    const js = jsEditor.getValue()

    // 清空控制台輸出
    consoleOutput.innerHTML = ""

    const outputContent = `
    <!DOCTYPE html>
    <html>
        <head>
            <link href="https://tauhu.tw/tauhu-oo.css" rel="stylesheet">
            <style>
                body, * {
                    font-family: 'tauhu-oo', Calibri, Arial, sans-serif !important;
                }
                ${css}
            </style>
        </head>
        <body>
            ${html}
            <script>
                // 重寫 console.log 函數 
                (function(){
                    var oldLog = console.log;
                    console.log = function(...args) {
                        oldLog.apply(console, args);
                        window.parent.postMessage({type: 'console', content: args.join(' ')}, '*');
                    };
                })();
                ${js}
            <\/script>
        </body>
    </html>
    `
    outputFrame.srcdoc = outputContent
  }

  // 監聽來自 iframe 的消息
  window.addEventListener("message", (event) => {
    if (event.data.type === "console") {
      const logElement = document.createElement("div")
      logElement.textContent = event.data.content
      consoleOutput.appendChild(logElement)
    }
  })

  // 初始化編輯器內容
  htmlEditor.setValue("<h1>烏衣行, 正來尞！</h1>")
  cssEditor.setValue("body { font-family: Arial, sans-serif; }")
  jsEditor.setValue('console.log("ngais vue gongx kaz su!");')

  // 加載當前狀態
  loadCurrentState()

  // 在編輯器內容改變時自動保存當前狀態
  htmlEditor.on("change", autoSaveCurrentState)
  cssEditor.on("change", autoSaveCurrentState)
  jsEditor.on("change", autoSaveCurrentState)

  // 自動保存當前狀態到 localStorage 的函數
  function autoSaveCurrentState() {
    const currentState = {
      html: htmlEditor.getValue(),
      css: cssEditor.getValue(),
      js: jsEditor.getValue(),
    }

    localStorage.setItem("currentState", JSON.stringify(currentState))
  }

  // 加載當前狀態的函數
  function loadCurrentState() {
    const savedState = localStorage.getItem("currentState")
    if (savedState) {
      const state = JSON.parse(savedState)
      htmlEditor.setValue(state.html)
      cssEditor.setValue(state.css)
      jsEditor.setValue(state.js)
    }
  }

  // 初始化歷史記錄和更新輸出
  Object.keys(editors).forEach(updateHistory)
  updateOutput()

  // 檢查 URL 參數並加載內容
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has("h") || urlParams.has("c") || urlParams.has("j")) {
    loadSharedContent(urlParams)
  }

  // 定義 loadSharedContent 函數
  function loadSharedContent(params) {
    if (params.has("h")) {
      const decodedHTML = decodeURIComponent(atob(params.get("h")))
      htmlEditor.setValue(decodedHTML)
    }
    if (params.has("c")) {
      const decodedCSS = decodeURIComponent(atob(params.get("c")))
      cssEditor.setValue(decodedCSS)
    }
    if (params.has("j")) {
      const decodedJS = decodeURIComponent(atob(params.get("j")))
      jsEditor.setValue(decodedJS)
    }

    // 移除 URL 的 h c j 參數，但保留 v 參數
    const newURL = new URL(window.location)
    newURL.searchParams.delete("h")
    newURL.searchParams.delete("c")
    newURL.searchParams.delete("j")
    window.history.replaceState({}, document.title, newURL)

    // 如果存在 v 參數，隱藏 head-container 並切換到 output 頁籤
    if (params.has("v")) {
      const headContainer = document.getElementById("head-container")
      if (headContainer) {
        headContainer.style.display = "none"
      }

      // 切換到 output 頁籤
      const outputTab = document.querySelector('.tab-button[data-tab="output"]')
      if (outputTab) {
        outputTab.click()
      }
    }
    // 更新輸出
    updateOutput()
  }
})

// 從 localStorage 加載版本
function loadVersions() {
  const savedVersions = localStorage.getItem("editorVersions")
  return savedVersions ? JSON.parse(savedVersions) : []
}

// 保存版本到 localStorage
function saveVersions() {
  localStorage.setItem("editorVersions", JSON.stringify(versions))
}

// 處理視窗大小變化時刷新編輯器
window.addEventListener("resize", () => {
  if (htmlEditor && cssEditor && jsEditor) {
    htmlEditor.refresh()
    cssEditor.refresh()
    jsEditor.refresh()
  }
})

// 處理頁籤和工具列的顯示邏輯
document.addEventListener("DOMContentLoaded", () => {
  const headContainer = document.getElementById("head-container")
  const tabsContainer = document.getElementById("tabs-container")
  const toggleButton = document.getElementById("toggle-tabs")
  const tabs = document.querySelector(".tabs")
  const toolbar = document.getElementById("toolbar")

  let isToolbarVisible = true
  let currentTab = "html" // 假設初始頁籤是HTML

  // 點擊tabsContainer
  if (tabsContainer) {
    tabsContainer.addEventListener("click", (event) => {
      // 確保點擊的不是toggleButton
      if (event.target !== toggleButton) {
        const clickedTab = event.target.closest(".tab-button")
        if (clickedTab) {
          const tabType = clickedTab.getAttribute("data-tab")
          currentTab = tabType
          if (["console", "output", "versions"].includes(tabType)) {
            toolbar.style.display = "none"
            isToolbarVisible = false
          } else {
            toolbar.style.display = "flex"
            isToolbarVisible = true
          }
        } else if (!["console", "output", "versions"].includes(currentTab)) {
          // 如果點擊的不是tab按鈕，且當前不在特殊頁籤，則切換toolbar的顯示狀態
          toggleToolbar()
        }
      }
    })
  }

  // 點擊toggleButton開合tabsContainer
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      if (tabsContainer.style.display === "none") {
        tabsContainer.style.display = "block"
        toggleButton.textContent = "▼"
      } else {
        tabsContainer.style.display = "none"
        toggleButton.textContent = "▲"
      }
    })
  }

  function toggleToolbar() {
    if (isToolbarVisible) {
      toolbar.style.display = "none"
    } else {
      toolbar.style.display = "flex"
    }
    isToolbarVisible = !isToolbarVisible
  }

  const params = new URLSearchParams(window.location.search)
  const shareThisBtn = document.querySelector(".shareThis-btn")

  // 如果存在 v 參數，隱藏 head-container 並切換到 output 頁籤
  if (params.has("v")) {
    if (headContainer) {
      headContainer.style.display = "none"
    }

    if (shareThisBtn) {
      shareThisBtn.style.display = "block"
    }

    // 切換到 output 頁籤
    const outputTab = document.querySelector('.tab-button[data-tab="output"]')
    if (outputTab) {
      outputTab.click()
    }
  }

  // 為 shareThis-btn 添加點擊事件
  if (shareThisBtn) {
    shareThisBtn.addEventListener("click", shareThis)
  }
})

// 分享功能
function shareThis() {
  // 從 localStorage 獲取當前內容
  const currentState = JSON.parse(localStorage.getItem("currentState"))

  if (!currentState) {
    alert("沒有可分享的內容")
    return
  }

  // 清理和編碼內容
  const cleanHTML = currentState.html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(\n)\s+/g, "$1")
    .replace(/\s+(\n)\s+/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s*([<>])\s*/g, "$1")
    .replace(/\n+/g, "")
    .trim()
  const cleanCSS = currentState.css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(\n)\s+/g, "$1")
    .replace(/\s+(\n)\s+/g, "")
    .replace(/\s*([:;{}])\s*/g, "$1")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n+/g, "")
    .trim()
  const cleanJS = currentState.js
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(\n)\s+/g, "$1")
    .replace(/\s+(\n)\s+/g, "")
    .replace(/\s*([=:+\-*/<>{}()[\],;])\s*/g, "$1")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n+/g, "")
    .trim()

  // 編碼並創建 URL 參數
  const params = new URLSearchParams({
    h: btoa(encodeURIComponent(cleanHTML)),
    c: btoa(encodeURIComponent(cleanCSS)),
    j: btoa(encodeURIComponent(cleanJS)),
    v: "x", // 使用 'x' 表示當前狀態
  })

  // 獲取當前 URL 並添加參數
  const shareURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`

  tinyurl(shareURL)
}

// 縮短網址功能
function tinyurl(currentURL) {
  if (currentURL.startsWith("http")) {
    // 偵測是否以http開頭;
    shortenUrl(currentURL)
      .then((shortenedUrl) => {
        navigator.clipboard.writeText(shortenedUrl) // 在這裡處理縮短後的網址
        alert("短已複製到剪貼簿")
      })
      .catch((error) => {
        navigator.clipboard.writeText(currentURL) // 無法縮短則複製原始網址
        alert("長網址已複製到剪貼簿")
      })
  } else {
    navigator.clipboard.writeText(currentURL) // 離線版的原始網址
    alert("離線長網址已複製到剪貼簿")
  }
}

// Tinyurl 縮短網址
async function shortenUrl(originalUrl) {
  const apiUrl = "https://tinyurl.com/api-create.php?url="
  const encodedUrl = encodeURIComponent(originalUrl)
  const shortenApiUrl = apiUrl + encodedUrl
  try {
    const response = await fetch(shortenApiUrl)
    const shortenedUrl = await response.text()
    return shortenedUrl // Tinyurl 縮短的網址
  } catch (error) {
    return originalUrl // 無法縮短則返回原始網址
  }
}

// 函數和樣式按鈕相關功能
document.addEventListener("DOMContentLoaded", () => {
  // 獲取函數按鈕元素
  const functionBtn = document.querySelector(".function-btn")
  const styleBtn = document.querySelector(".style-btn")

  if (functionBtn && styleBtn) {
    // 當切換到JS編輯器時顯示函數按鈕，隱藏樣式按鈕
    document.querySelector('.tab-button[data-tab="js"]').addEventListener("click", () => {
      functionBtn.style.display = "inline-block"
      styleBtn.style.display = "none"
    })

    // 當切換到CSS編輯器時顯示樣式按鈕，隱藏函數按鈕
    document.querySelector('.tab-button[data-tab="css"]').addEventListener("click", () => {
      styleBtn.style.display = "inline-block"
      functionBtn.style.display = "none"
    })

    // 當切換到其他編輯器時隱藏函數按鈕和樣式按鈕
    document.querySelectorAll('.tab-button:not([data-tab="js"]):not([data-tab="css"])').forEach((button) => {
      button.addEventListener("click", () => {
        functionBtn.style.display = "none"
        styleBtn.style.display = "none"
      })
    })

    // 初始狀態設置 - 根據當前活動的標籤設置按鈕顯示狀態
    const activeTab = document.querySelector(".tab-button.active")
    if (activeTab) {
      const tabType = activeTab.getAttribute("data-tab")
      if (tabType === "js") {
        functionBtn.style.display = "inline-block"
        styleBtn.style.display = "none"
      } else if (tabType === "css") {
        styleBtn.style.display = "inline-block"
        functionBtn.style.display = "none"
      } else {
        functionBtn.style.display = "none"
        styleBtn.style.display = "none"
      }
    }

    // 函數按鈕點擊事件
    functionBtn.addEventListener("click", () => {
      if (jsEditor) {
        const jsCode = jsEditor.getValue()
        const functions = extractFunctions(jsCode)
        showFunctionList(functions)
      }
    })

    // 樣式按鈕點擊事件
    styleBtn.addEventListener("click", () => {
      if (cssEditor) {
        const cssCode = cssEditor.getValue()
        const styles = extractStyles(cssCode)
        showStyleList(styles)
      }
    })
  }
})

// 提取JavaScript代碼中的函數
function extractFunctions(code) {
  const functionRegex = /(?:\/\/\s*(.+)\s*\n)?\s*function\s+(\w+)\s*$$[^)]*$$\s*{/g
  const functions = []
  let match

  while ((match = functionRegex.exec(code)) !== null) {
    const comment = match[1] ? match[1].trim() : ""
    const title = comment.length > 20 ? comment.substring(0, 20) + "..." : comment
    functions.push({
      name: match[2],
      position: match.index,
      title: title,
    })
  }

  return functions
}

// 顯示函數列表
function showFunctionList(functions) {
  // 移除舊的函數列表（如果存在）
  const oldList = document.querySelector(".function-list")
  if (oldList) {
    oldList.remove()
  }

  // 創建新的函數列表
  const listContainer = document.createElement("div")
  listContainer.className = "function-list"

  const title = document.createElement("h3")
  title.textContent = "🥷 函數目錄"
  listContainer.appendChild(title)

  const list = document.createElement("ol")
  functions.forEach((func) => {
    const item = document.createElement("li")
    item.textContent = func.name
    if (func.title) {
      item.setAttribute("title", func.title)
    }
    item.addEventListener("click", () => {
      jsEditor.setCursor(jsEditor.posFromIndex(func.position))
      jsEditor.focus()
      listContainer.remove()
    })
    list.appendChild(item)
  })

  if (functions.length < 1) {
    return
  }

  listContainer.appendChild(list)
  document.body.appendChild(listContainer)

  // 點擊列表外部時關閉列表
  document.addEventListener("click", function closeList(e) {
    if (!listContainer.contains(e.target) && e.target !== document.querySelector(".function-btn")) {
      listContainer.remove()
      document.removeEventListener("click", closeList)
    }
  })
}

// 提取CSS代碼中的樣式
function extractStyles(code) {
  const styleRegex = /(?:\/\*\s*(.+?)\s*\*\/)?\s*([^{]+)\s*{[^}]*}/g
  const styles = []
  let match
  while ((match = styleRegex.exec(code)) !== null) {
    const comment = match[1] ? match[1].trim() : ""
    const selector = match[2].trim()
    const title = comment.length > 15 ? comment.substring(0, 15) + "..." : comment
    styles.push({
      selector: selector,
      position: match.index,
      title: title,
    })
  }
  return styles
}

// 顯示樣式列表
function showStyleList(styles) {
  // 移除舊的樣式列表（如果存在）
  const oldList = document.querySelector(".style-list")
  if (oldList) {
    oldList.remove()
  }

  // 創建新的樣式列表
  const listContainer = document.createElement("div")
  listContainer.className = "style-list"

  const title = document.createElement("h3")
  title.textContent = "🥷 樣式目錄"
  listContainer.appendChild(title)

  const list = document.createElement("ol")
  styles.forEach((style) => {
    const item = document.createElement("li")
    item.textContent = style.selector
    if (style.title) {
      item.setAttribute("title", style.title)
    }
    item.addEventListener("click", () => {
      cssEditor.setCursor(cssEditor.posFromIndex(style.position))
      cssEditor.focus()
      listContainer.remove()
    })
    list.appendChild(item)
  })

  if (styles.length < 1) {
    return
  }

  listContainer.appendChild(list)
  document.body.appendChild(listContainer)

  // 點擊列表外部時關閉列表
  document.addEventListener("click", function closeList(e) {
    if (!listContainer.contains(e.target) && e.target !== document.querySelector(".style-btn")) {
      listContainer.remove()
      document.removeEventListener("click", closeList)
    }
  })
}

// 宣告 js_beautify, html_beautify, css_beautify
const js_beautify = window.js_beautify
const html_beautify = window.html_beautify
const css_beautify = window.css_beautify
