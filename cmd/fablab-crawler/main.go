package main

import (
	//	"bytes"
	"flag"
	"fmt"
	"github.com/PuerkitoBio/fetchbot"
	"github.com/loic-fejoz/microformat-golang-toolbox"
	"log"
	"net/http"
	"net/url"
	//	"runtime"
	//	"strings"
	"golang.org/x/net/html"
	"sync"
	"time"
	"encoding/json"
)

var (
	// Protect access to dup
	mu sync.Mutex
	// Duplicates table
	dup            = map[string]bool{}
	hCardDirectory = map[string]*microformat2.Element{}
	// Command-line flags
	seed      = flag.String("visit", "http://localhost/mediawiki/index.php/Accueil" /* "http://wiki.nybi.cc/index.php/Utilisateur:Loic.fejoz"*/, "seed URL, ie where to start")
	stopAfter = flag.Duration("stopafter", 0, "automatically stop the fetchbot after a given time")
)

func writePeopleDirectory() {
	fmt.Printf("[\n");
	for _, hCard := range hCardDirectory {
		b, err := json.MarshalIndent(hCard, "", "  ")
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s,\n", b);
	}
	fmt.Printf("]\n");
}

func main() {
	flag.Parse()
	// Parse the provided seed
	u, err := url.Parse(*seed)
	if err != nil {
		log.Fatal(err)
	}
	// Create the muxer
	mux := fetchbot.NewMux()

	// Handle all errors the same
	mux.HandleErrors(fetchbot.HandlerFunc(func(ctx *fetchbot.Context, res *http.Response, err error) {
		fmt.Printf("[ERR] %s %s - %s\n", ctx.Cmd.Method(), ctx.Cmd.URL(), err)
	}))
	// Handle GET requests for html responses, parse for Microformat 2 (more to come), and follow new links
	mux.Response().Method("GET").ContentType("text/html").Handler(fetchbot.HandlerFunc(
		func(ctx *fetchbot.Context, res *http.Response, err error) {
			// Process the body to find the links

			doc, err := html.Parse(res.Body)
			if err != nil {
				fmt.Printf("[ERR] %s %s - %s\n", ctx.Cmd.Method(), ctx.Cmd.URL(), err)
				return
			}
			microformats, err := microformat2.Parse(doc)
			if err != nil {
				fmt.Printf("[ERR] %s %s - %s\n", ctx.Cmd.Method(), ctx.Cmd.URL(), err)
				return
			}
			enqueueLinks(ctx, microformats)
		}))
	// Handle HEAD requests for html responses coming from the source host - we don't want
	// to crawl links from other hosts.
	mux.Response().Method("HEAD").Host(u.Host).ContentType("text/html").Handler(fetchbot.HandlerFunc(
		func(ctx *fetchbot.Context, res *http.Response, err error) {
			if _, err := ctx.Q.SendStringGet(ctx.Cmd.URL().String()); err != nil {
				fmt.Printf("[ERR] %s %s - %s\n", ctx.Cmd.Method(), ctx.Cmd.URL(), err)
			}
		}))
	// Create the Fetcher, handle the logging first, then dispatch to the Muxer
	h := logHandler(mux)
	f := fetchbot.New(h)
	f.AutoClose = true
	// Start processing
	q := f.Start()
	if *stopAfter > 0 {
		go func() {
			c := time.After(*stopAfter)
			<-c
			q.Close()
		}()
	}
	// Enqueue the seed, which is the first entry in the dup map
	dup[*seed] = true
	_, err = q.SendStringGet(*seed)
	if err != nil {
		fmt.Printf("[ERR] GET %s - %s\n", *seed, err)
	}
	q.Block()
	writePeopleDirectory()
	fmt.Printf("bye\n")
}

// logHandler prints the fetch information and dispatches the call to the wrapped Handler.
func logHandler(wrapped fetchbot.Handler) fetchbot.Handler {
	return fetchbot.HandlerFunc(func(ctx *fetchbot.Context, res *http.Response, err error) {
		if err == nil {
			fmt.Printf("[%d] %s %s - %s\n", res.StatusCode, ctx.Cmd.Method(), ctx.Cmd.URL(), res.Header.Get("Content-Type"))
		}
		wrapped.Handle(ctx, res, err)
	})
}

func visitUrl(ctx *fetchbot.Context, url string) {
	// Resolve address
	u, err := ctx.Cmd.URL().Parse(url)
	if err != nil {
		fmt.Printf("error: resolve URL %s - %s\n", url, err)
		return
	}
	if !dup[u.String()] {
		if _, err := ctx.Q.SendStringGet(u.String()); err != nil {
			fmt.Printf("error: enqueue get %s - %s\n", u, err)
		} else {
			fmt.Printf("Enqueuing %s\n", u)
			dup[u.String()] = true
		}
	}
}

func registerHCard(hCard *microformat2.Element) {
	// Keep (or consolidate) the hCard in the directory if has an identifier, be it UID or first URL
	theUID, err := microformat2.GetUID(hCard)
	if err != nil {
		previous := hCardDirectory[theUID]
		if previous == nil {
			hCardDirectory[theUID] = hCard
		} else {
			hCardDirectory[theUID] = microformat2.Append(previous, hCard)
		}
	}
}

func enqueueLinksOf(ctx *fetchbot.Context, hCard *microformat2.Element) {
	registerHCard(hCard)
	urls := hCard.Properties["url"]
	if urls != nil {
		// Enqueue all urls
		for _, url := range urls {
			visitUrl(ctx, url.(string))
		}
	}
}

func enqueueLinks(ctx *fetchbot.Context, result *microformat2.Result) {
	mu.Lock()
	for _, hCard := range result.Items {
		// Visit this card urls from properties
		enqueueLinksOf(ctx, hCard)
		orgs := hCard.Properties["org"]
		// Visit urls of this card's organisation
		if orgs != nil {
			for _, org := range orgs {
				orgElt := org.(*microformat2.Element)
				if orgElt != nil {
					enqueueLinksOf(ctx, hCard)
				}
			}
		}
	}
	fmt.Printf("[TREATED] %s %s\n", ctx.Cmd.Method(), ctx.Cmd.URL())
	mu.Unlock()
}
