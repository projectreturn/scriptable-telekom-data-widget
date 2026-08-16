const dataUrl = "https://pass.telekom.de/home"
const cacheFileName = "scriptable-telekom.json"

const widget = await createWidget()
widget.backgroundColor = new Color("#000000")

if (!config.runsInWidget) {
  await widget.presentSmall()
}

Script.setWidget(widget)
Script.complete()

async function createWidget() {
  const fm = FileManager.local()
  const cachePath = fm.joinPath(fm.documentsDirectory(), cacheFileName)

  const list = new ListWidget()
  list.backgroundColor = new Color("#000000")
  list.addSpacer(16)

  let data
  let fresh = false

  try {
    const request = new Request(dataUrl)
    request.headers = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
        "Version/18.0 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/xhtml+xml"
    }

    const html = await request.loadString()
    const remainingText = extractByClass(html, "remaining-volume-value")
    const totalText = extractByClass(html, "start-volume")
    const unit = extractByClass(html, "volume-unit")

    if (!remainingText || !totalText || !unit) {
      throw new Error("Datenvolumen konnte im HTML nicht gefunden werden.")
    }

    const remaining = parseGermanNumber(remainingText)
    const total = parseGermanNumber(totalText)

    if (!Number.isFinite(remaining) || !Number.isFinite(total) || total <= 0) {
      throw new Error("Datenvolumen enthält ungültige Zahlenwerte.")
    }

    const used = Math.max(0, total - remaining)

    data = {
      remainingVolumeStr: `${formatNumber(remaining)} ${unit}`,
      initialVolumeStr: `${formatNumber(total)} ${unit}`,
      usedVolumeStr: `${formatNumber(used)} ${unit}`,
      usedPercentage: Math.round((used / total) * 100),
      timestamp: new Date().toISOString()
    }

    fm.writeString(cachePath, JSON.stringify(data, null, 2))
    fresh = true
  } catch (error) {
    console.log(`Abruf fehlgeschlagen: ${error}`)

    if (!fm.fileExists(cachePath)) {
      return createErrorWidget(
        "Bitte WLAN deaktivieren und das Widget einmal über das Mobilfunknetz starten."
      )
    }

    try {
      data = JSON.parse(fm.readString(cachePath))
    } catch (cacheError) {
      console.log(`Cache konnte nicht gelesen werden: ${cacheError}`)
      return createErrorWidget("Keine gültigen Daten vorhanden.")
    }
  }

  const textColor = fresh ? Color.gray() : Color.darkGray()

  const percentageLine = list.addText(`${data.usedPercentage}%`)
  percentageLine.font = Font.boldSystemFont(36)
  percentageLine.textColor = textColor

  const volumeLine = list.addText(
    `${data.usedVolumeStr} / ${data.initialVolumeStr}`
  )
  volumeLine.font = Font.mediumSystemFont(12)
  volumeLine.textColor = textColor

  return list
}

function extractByClass(html, className) {
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(
    `<[^>]*class=["'][^"']*\\b${escapedClassName}\\b[^"']*["'][^>]*>\\s*([^<]+)`,
    "i"
  )
  return extract(html, regex)
}

function extract(html, regex) {
  const match = html.match(regex)
  return match ? cleanText(match[1]) : null
}

function parseGermanNumber(value) {
  return Number(value.trim().replace(/\./g, "").replace(",", "."))
}

function formatNumber(value) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function cleanText(value) {
  if (!value) return null

  return value
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function createErrorWidget(message) {
  const errorWidget = new ListWidget()
  errorWidget.backgroundColor = new Color("#000000")
  errorWidget.addSpacer()

  const text = errorWidget.addText(message)
  text.font = Font.mediumSystemFont(12)
  text.textColor = Color.gray()

  errorWidget.addSpacer()
  return errorWidget
}
