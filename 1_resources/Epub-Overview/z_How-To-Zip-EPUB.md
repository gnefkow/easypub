The `chapters.txt` file has the chapters. 


**On the command line:**

First, cd into the repo root folder.

Then:

pandoc -t epub3 \
  --metadata-file=0_resources/Epub-Overview/metadata.yaml \
  --epub-cover-image=0_resources/Epub-Overview/cover_epubs-a-simple-introduction.png \
  -o epubs/epubs-a-simple-introduction.epub \
  $(cat 0_resources/Epub-Overview/chapters.txt)