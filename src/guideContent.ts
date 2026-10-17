/** English help content shared by the in-app Guide and docs/GETTING_STARTED.md.
 * shortHelp is the reusable text for contextual help beside UI headings.
 * After editing, run npm run docs:guide.
 */
export const GUIDE = {
  title: "Your first comic in ComicBook AI",
  intro: "Start with one page, three pictures and a few lines of dialogue. You can learn the editor with your own images, then explore manuscript planning and AI image prompts when you are ready.",
  beta: "This guide describes the current beta. Some features and labels may change. The guide is in English; choose English in the language selector if you want the interface labels to match.",
  topics: [
    {
      id: "first-album", title: "1. Create a small test album", group: "start",
      shortHelp: "An album holds your pages, images, text and visual style. Start with an empty project to try the editor without importing a manuscript.",
      paragraphs: ["For your first test, tell a simple three-panel story: someone arrives, notices something unexpected, and reacts. Have three PNG, JPEG or WebP pictures ready. Photos or sketches work just as well as AI illustrations."],
      steps: ["Open Project → New comic album. Give the project a name, such as My first comic.", "Choose Start with an empty project and a Style template, then select Create project.", "Open Pages. If there is no page yet, select Create first page."],
      tip: "You do not need an AI account, a local model or a StoryBook project for this exercise. The style template helps build image prompts; it does not repaint pictures you upload."
    },
    {
      id: "page-layout", title: "2. Build your page", group: "start",
      shortHelp: "Drag across empty grid cells to draw a panel. Click a panel to select it, drag its corner handles to resize it, or double-click it to open the editor.",
      paragraphs: ["A panel is a framed part of the comic page. Start with three simple rectangles and leave space for dialogue."],
      steps: ["Drag across empty cells in the page grid, then release to create your first panel. Repeat for the other two panels.", "Right-click a panel and choose Upload image… to add a picture from your computer.", "Click a panel and drag a corner handle if you want to change its size. Double-click the panel to open its image and text editor."],
      tip: "Later, use Album settings to set page size, margins, gaps and the default panel border. These choices affect the space available for pictures and text."
    },
    {
      id: "image-editing", title: "3. Position the picture", group: "start",
      shortHelp: "Choose Edit image, then drag to position it. Ctrl/Command + scroll zooms; Alt + scroll rotates. Escape exits image editing. Reset image restores the default framing.",
      paragraphs: ["The picture fills the panel by default, so some edges may be cropped. Adjust the picture until the important part of the scene is visible."],
      steps: ["In the panel editor, select Edit image. Bubbles are hidden while you position the picture.", "Drag the picture to move it. Hold Ctrl or Command while scrolling to zoom, or Alt while scrolling to rotate.", "Use the position, zoom and rotation fields for precise adjustments. You can also flip the image horizontally or vertically.", "Choose Done editing image, or press Escape, to return to text editing."],
      tip: "Reset image restores the default framing, including rotation and flips. To replace a picture in the editor, use Remove image and upload a new one."
    },
    {
      id: "bubble-text", title: "4. Add dialogue and captions", group: "start",
      shortHelp: "Add a speech bubble, thought bubble, caption or sound effect. Double-click its text to type directly. Text color is separate from the bubble fill, so white text can sit on a transparent bubble.",
      paragraphs: ["Use speech bubbles for spoken dialogue, thought bubbles for thoughts, captions for narration and SFX for sound effects. Keep the first page short enough to read at a glance."],
      steps: ["Add a text layer in the panel editor and choose its type. Move and resize it to fit the available space.", "Double-click the text to type directly in the bubble. Enter inserts a new line; click outside to finish. Escape cancels the current inline text edit.", "Select the text layer to adjust its font, size, alignment and Text color. Text size is measured in points (pt). Adjust the fill and its opacity separately.", "Position the tail so it clearly points to the speaker. Read the whole panel and check that text does not cover an important face or action."],
      tip: "For mixed typography, select part of the text in the text field and change its font, weight, size or color. Compatible speech or thought bubbles can be linked; the source bubble’s tail becomes the connection."
    },
    {
      id: "backup", title: "5. Save a backup you can restore", group: "start",
      shortHelp: "Automatic saving keeps the album in this browser. Download an album backup to keep an editable copy with images. A PDF or PNG export is not an album backup.",
      paragraphs: ["Albums are saved automatically in this browser on this device. There is no cloud sync. Another browser, browser profile or app address has separate storage; clearing site data can remove locally saved albums."],
      steps: ["Open the album menu and choose the backup option. Download an album backup and keep the file somewhere you can find it.", "To recover it, open Project → Restore album backup, choose the file and review the import. Restoring creates a separate album.", "Make another backup before updating the beta or moving to a different computer or browser."],
      tip: "If the app reports a saving error, download a backup of the open album before reloading or closing the tab. Unsaved changes may still exist only in the open app."
    },
    {
      id: "export", title: "6. Export and read your first page", group: "start",
      shortHelp: "Export creates files for reading or further layout work. Choose PDF, PNG, JPEG or IDML. Keep an album backup as well if you want to continue editing in ComicBook AI.",
      paragraphs: ["Finish the exercise by looking at the exported page, where the grid and editing handles are hidden."],
      steps: ["Open Export in the album menu. Select PDF for a convenient reading copy, or PNG/JPEG for page images.", "Choose the pages and resolution, then select Download export. Multiple PNG/JPEG pages are packaged in a ZIP.", "Open the downloaded file and check reading order, picture crops, text size, contrast and line wrapping."],
      tip: "IDML — InDesign / Affinity (beta) is for further editing in a page-layout application. Extract the entire ZIP before opening the IDML file, and check fonts, wrapping and layout after import."
    },
    {
      id: "manuscript", title: "From manuscript to panel plans", group: "more",
      shortHelp: "A beat is a story moment selected from your manuscript. Give it one or more panel plans, then prepare pictures for those panels and place them on pages.",
      paragraphs: ["Once you are comfortable with the editor, use Manuscript to plan a longer story. A manuscript is the source text; a beat is a meaningful story moment; a panel plan describes one illustration. A page frame is where that panel is placed in the layout."],
      steps: ["Enter your source text in Manuscript, or create an album from a StoryBook export. Importing copies the content into ComicBook AI and does not change StoryBook.", "Select a short passage in the manuscript and use the selection menu to create a beat. Choose a moment that can be shown clearly.", "Give the beat one or more panel plans. Describe the visible action and prepare dialogue or captions separately from the illustration.", "If you want help suggesting beats, configure a local text model in Settings first. Review its suggestions before adding them to your plan."],
      tip: "One sentence does not have to equal one panel. An action may need several images; a long description may need only one establishing shot."
    },
    {
      id: "image-prompts", title: "Prepare prompts and bring pictures back", group: "more",
      shortHelp: "An image prompt combines the album style with the panel’s subjects, action and camera choices. Copy it to your image tool, then upload the resulting picture to the panel plan.",
      paragraphs: ["In the prompt workflow, ComicBook AI prepares the text instructions for an image tool. Creating a prompt does not create a picture. Keep dialogue out of the illustration so that it stays editable in the comic editor."],
      steps: ["Open a panel plan in Manuscript. Generate its image prompt, or open Adjust image prompt to refine characters, action, setting and camera choices.", "Copy the prompt to the image-generation tool you use. Review the result for character identity, clothing, staging and space for text.", "Upload the finished picture to its panel plan. In Pages, find it in the Image library and drag an unplaced image into an existing frame or an empty area of the page."],
      tip: "Use Characters and Locations to record recurring visual details. Consistent descriptions and reference images help you keep the same people and places recognizable."
    },
    {
      id: "styles", title: "Choose a consistent visual style", group: "more",
      shortHelp: "Style templates control the visual language of image prompts. The album keeps its own copy. After changing the album style, explicitly regenerate any existing prompts you want to update.",
      paragraphs: ["Choose a style for the story rather than changing it for every panel. The library supports categories, tags, search and favorites to help you find and compare templates."],
      steps: ["Open Style templates to browse the library. Use for project applies a style to the active album.", "Duplicate a template if you want your own version, then edit its drawing, color and finish instructions. Use the supported color modes where available.", "After changing styles, regenerate the affected panel prompts. Previously saved prompts and uploaded pictures do not change automatically."],
      tip: "Changing a library template does not silently update an album’s saved copy. Apply the updated style to the album when you want to use it there."
    },
    {
      id: "beta-feedback", title: "When something does not look right", group: "more",
      shortHelp: "For a useful beta report, include what you tried, what you expected, what happened, the steps to repeat it and a screenshot. Back up the album before investigating a saving problem.",
      paragraphs: ["If the Image library is empty, upload pictures to panel plans in Manuscript first, or use right-click → Upload image… on a page panel. If all pictures seem to have disappeared from the library, check Show unplaced only.", "If text disappears over a dark image, select its text layer and set Text color to a lighter color. Changing the bubble fill does not change the text color.", "If an image prompt still describes an old style, apply the desired style to the album and regenerate that prompt. If an album seems missing, return to the same browser, profile and app address, or restore your backup."],
      steps: ["Write down the steps that led to the problem, including the section and control you used.", "Describe the expected result and the actual result. Include a screenshot, browser and operating system, and any error message.", "For layout problems, compare the editor with a PDF or PNG export and say whether the issue appears in both."],
      tip: "A useful first beta session is complete when you have made one page, edited a bubble directly, repositioned an image, exported the page and downloaded an album backup."
    }
  ]
} as const;

export type GuideTopicId = typeof GUIDE.topics[number]["id"];
export function guideTopic(id: GuideTopicId) {
  return GUIDE.topics.find(topic => topic.id === id)!;
}
