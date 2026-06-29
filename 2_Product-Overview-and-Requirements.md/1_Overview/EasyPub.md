
## **Overview**
EasyPub is an app that enables users to re-format epub documents in an easy-to-use web interface. 

**The Problem:** The world is awash with poorly-formatted epubs. Some consists of bad formatting from publishers. A larger problem is that PDF → EPUB conversion software does a good job of *literally* converting the contents, but PDF formatting articfacts (like page numbers) and other issues abound. 

**The Solution:** With EasyPub, users can import a poorly formatted epub file, use the interface to make their changes, and then export a cleaner, formatted epub. 

## **Product Architecture and Code**
--------------------------------------------------
To get an understanding read the [EasyPub-Overview](../2_PRD/PRD_1.1_EasyPub-Overview.md). Depending on the feature you're reading, it may be helpful to read one of the other PRD documents to get a sense of how things work:
- [1.2 Section Management](../2_PRD/PRD_1.2_Section_Manage-Sections.md) discusses the way we load sections into the app. "Sections" refer to the "content documents" of an epub. The app loads and renders them one at a time based on the user's actions. 
- [1.3 Viewer and Text Block](../2_PRD/PRD_1.3_Viewer_and_Text_Block.md) This is the primary editing surface for epub content. Each <p>, <h1>, <h2> etc... for a section is rendered in a `text-block` that has a default mode and an edit mode. These are stacked and displayed in a front-end component called the `viewer`.
- [1.4 Endnotes](/2_Product-Overview-and-Requirements.md/2_PRD/PRD_1.4_Endnotes.md) has notes for our "endnotes" feature, which enables users to see and add contentt o the end notes. 