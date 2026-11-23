


These are always a part of building tickets:
- **Theme Colors** We ALWAYS build things with the "Theme-aware color system" colors building off of the Counterfoil Semantic Tokens. 
- **Typography** when importing from Figma, ALWAYS check for matches in the [typography](/constants/styles/typography.ts). Note that you may need to bridge between FIgma and the codebase (for example, `UI-body-1` to `UIbody1`)
- **Components** Whenever possible, we use [Existing UI Components](../3_App/src/components/). If it is unclear what to use, ask the user as we're building the ticket. He will appreciate offering trade-offs in component design when decisions need to be made. 
- **Horizontal rules in markdown files should have 100 dashes.** True, from a code perspective, all we need is "---". However, the user spends a lot of time looking at .md files in a code editor, so three dashes does not offer enough visual distinction, Whenever you're writing, in a markdown file and need to have a horizontal rule, use 


### **Wrapping Up a Ticket**
--------------------------------------------------
After implementing a ticket, ask the user if they want to test it, and if you should do wrap up activities. 
These are the wrap-up activities:
- **Add Ticket Metadata:** We add metadata to the top of the tickets for easy reference if we ever need to investigate how something was implemented in the past. When you finish the ticket, add keywords to the metadata to make this look up easy in the future. 
- **Update the PRD:** Scan the [Product Requirements Docs](../2_Product-Overview-and-Requirements.md/) to see if anything needs to be updated. Tell the user which files (if any) should be updated based on the recent ticket changes.
- **Update Memory:** Write to your memory file that we've made these updates. Include file paths that could serve as references to the future for the files you updated and the ticket associated with those updates. 