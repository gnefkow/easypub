- Renaming the title of the book. 
- Hyper links in Table of Contents





**Page numbers in table of contents.**
 If you need “real page” references (matching a print edition), use the EPUB 3 mechanism for that instead of faking it visually:
<nav epub:type="page-list"> (a page list nav), plus
epub:type="pagebreak" markers in the content documents that the page-list links point to.