README.html: README.md
	markdown $< > $@

clean:
	rm -f *~

distclean: clean
	rm -f README.html
