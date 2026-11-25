#!/usr/bin/env python3
"""Rebuild the Word copies of the Golden theme guides from their HTML source.

The HTML files are the source of truth. This script finds every guide in this
directory - each one names itself with a `guide-kind` and a `docx-name` meta -
bakes its `images/...` references into the HTML as data URIs, then maps the
components it is built from onto Word equivalents and writes the .docx beside
it, with the same pictures embedded. Both files then stand alone when handed
to a client.

Run it after editing a guide:

    python3 docs/build-docx.py

No dependencies - the .docx package is written by hand.
"""

import base64
import hashlib
import html
import os
import re
import zipfile
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- design ----

# Fonts that ship with both macOS and Windows, so the client sees what we see.
SANS, SERIF, MONO = "Trebuchet MS", "Georgia", "Courier New"

INK, INK_SOFT, INK_FAINT = "18211D", "4D5A53", "7A857D"
EVERGREEN, BRASS, WARN = "1E4738", "8A6114", "8C4116"
SURFACE2, BRASS_TINT, WARN_TINT = "F2F4EF", "F6ECD6", "F9E9DD"
RULE, RULE_STRONG = "E1E4DB", "C8CEC4"

CONTENT_W = 9360           # dxa inside 1in margins on US Letter
SZ = {"h1": 56, "h2": 32, "h3": 24, "body": 21, "small": 18, "label": 16}

# ------------------------------------------------------------ xml helpers ---


def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def rpr(font=None, b=False, i=False, caps=False, color=None, spacing=None, sz=None):
    """Run properties, in the order the OOXML schema enforces."""
    out = []
    if font:
        out.append(f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>')
    if b:
        out.append("<w:b/>")
    if i:
        out.append("<w:i/>")
    if caps:
        out.append("<w:caps/>")
    if color:
        out.append(f'<w:color w:val="{color}"/>')
    if spacing is not None:
        out.append(f'<w:spacing w:val="{spacing}"/>')
    if sz:
        out.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
    return f'<w:rPr>{"".join(out)}</w:rPr>' if out else ""


def run(text, **fmt):
    if not text:
        return ""
    return f'<w:r>{rpr(**fmt)}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'


def brk():
    return "<w:r><w:br/></w:r>"


def para(inner, style=None, num=None, shd=None, border=None, before=0, after=120,
         line=276, ind=None, keep=False):
    """Paragraph properties, in schema order."""
    p = []
    if style:
        p.append(f'<w:pStyle w:val="{style}"/>')
    if keep:
        p.append("<w:keepNext/><w:keepLines/>")
    if num:
        p.append(f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num}"/></w:numPr>')
    if border:
        p.append(f'<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" '
                 f'w:color="{border}"/></w:pBdr>')
    if shd:
        p.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    p.append(f'<w:spacing w:before="{before}" w:after="{after}" w:line="{line}" '
             f'w:lineRule="auto"/>')
    if ind:
        p.append(f'<w:ind w:left="{ind}"/>')
    pr = f'<w:pPr>{"".join(p)}</w:pPr>'
    return f"<w:p>{pr}{inner}</w:p>"


def body_p(inner, **kw):
    kw.setdefault("after", 140)
    return para(inner, **kw)


def cell(blocks, w, shd=None, borders=None, valign="top", margins=(80, 120, 80, 120)):
    pr = [f'<w:tcW w:w="{w}" w:type="dxa"/>']
    if borders:
        pr.append(borders)
    if shd:
        pr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    t, r, b, l = margins
    pr.append(f'<w:tcMar><w:top w:w="{t}" w:type="dxa"/><w:left w:w="{l}" w:type="dxa"/>'
              f'<w:bottom w:w="{b}" w:type="dxa"/><w:right w:w="{r}" w:type="dxa"/></w:tcMar>')
    pr.append(f'<w:vAlign w:val="{valign}"/>')
    return f'<w:tc><w:tcPr>{"".join(pr)}</w:tcPr>{"".join(blocks) or "<w:p/>"}</w:tc>'


def borders(color=RULE, sz=4, sides="tlbr"):
    m = {"t": "top", "l": "left", "b": "bottom", "r": "right"}
    out = []
    for k in "tlbr":
        side = m[k]
        if k in sides:
            out.append(f'<w:{side} w:val="single" w:sz="{sz}" w:color="{color}"/>')
        else:
            out.append(f'<w:{side} w:val="nil"/>')
    return f'<w:tcBorders>{"".join(out)}</w:tcBorders>'


def table(rows, widths):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    pr = (f'<w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/>'
          f'{f"<w:tblInd w:w={indent} w:type=dxa/>" if False else ""}'
          '<w:tblBorders>'
          f'<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/>'
          f'<w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/>'
          '</w:tblBorders>'
          '<w:tblLayout w:type="fixed"/>'
          '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>'
          '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
          '<w:tblLook w:val="0000"/></w:tblPr>')
    body = "".join(f"<w:tr><w:trPr><w:cantSplit/></w:trPr>{r}</w:tr>" for r in rows)
    return f"<w:tbl>{pr}<w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl>"


def gap(h=180):
    return (f'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="{h}" '
            f'w:lineRule="exact"/></w:pPr></w:p>')


def boxed(blocks, fill, border, width=CONTENT_W):
    """A one-cell table - the closest Word has to a callout."""
    return table([cell(blocks, width, shd=fill, borders=borders(border, 8),
                       margins=(120, 180, 120, 180))], [width])


# ----------------------------------------------------------- html parsing ---


class Node:
    def __init__(self, tag, attrs=None):
        self.tag = tag
        self.attrs = dict(attrs or {})
        self.children = []

    @property
    def cls(self):
        return set(self.attrs.get("class", "").split())

    def find_all(self, tag=None, cls=None):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                if (tag is None or c.tag == tag) and (cls is None or cls in c.cls):
                    out.append(c)
                out.extend(c.find_all(tag, cls))
        return out

    def first(self, tag=None, cls=None):
        got = self.find_all(tag, cls)
        return got[0] if got else None

    def text(self):
        return re.sub(r"\s+", " ", self.raw()).strip()

    def raw(self):
        """Text with whitespace intact - for <pre>."""
        return "".join(c if isinstance(c, str) else c.raw() for c in self.children)


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}
SKIP = {"script", "style", "title"}


class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]
        self.muted = 0

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.muted += 1
            return
        if self.muted:
            return
        n = Node(tag, attrs)
        self.stack[-1].children.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.muted = max(0, self.muted - 1)
            return
        if self.muted or tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.muted:
            return
        if data.strip():
            self.stack[-1].children.append(data)
        elif data and self.stack[-1].children:
            # whitespace between inline elements is a real space
            self.stack[-1].children.append(" ")


def parse(path):
    b = Builder()
    b.feed(open(path, encoding="utf-8").read())
    return b.root


# --------------------------------------------------------------- inlines ----


def inline(node, font, color=INK_SOFT, sz=SZ["body"], bold=False, in_link=False):
    """Turn inline HTML into runs, honouring b/strong/em/code and our tag spans."""
    out = []
    for c in node.children:
        if isinstance(c, str):
            t = re.sub(r"\s+", " ", c)
            if t:
                out.append(run(t, font=font, color=color, sz=sz, b=bold))
            continue
        k = c.cls
        if c.tag in ("b", "strong"):
            out.append("".join(inline(c, font, INK, sz, True)))
        elif c.tag == "em" or c.tag == "i":
            out.append(run(c.text(), font=font, i=True, color=color, sz=sz, b=bold))
        elif c.tag == "code":
            keyish = in_link or "mf-key" in k
            out.append(run(c.text(), font=MONO, color=BRASS if keyish else INK,
                           sz=sz - 3, b=bold))
        elif "arrow" in k or "sep" in k:
            out.append(run(c.text(), font=font, color=INK_FAINT, sz=sz))
        elif "tag--muted" in k:
            out.append(run(c.text(), font=font, i=True, color=INK_FAINT, sz=sz - 2))
        elif "tag" in k:
            out.append(run(c.text(), font=SANS, color=INK_SOFT, sz=SZ["small"]))
        elif c.tag == "br":
            out.append(brk())
        else:
            out.append("".join(inline(c, font, color, sz, bold,
                                      in_link or c.tag == "a")))
    return out


def label_runs(text, color=INK_FAINT):
    return run(text, font=SANS, b=True, caps=True, color=color,
               spacing=20, sz=SZ["label"])


# ---------------------------------------------------------------- images ----

EMU_PER_PX = 9525          # at 96 dpi
EMU_PER_DXA = 635
MAX_H = int(5.5 * 914400)  # keep one screenshot to about half a page


def image_size(data, path):
    """Pixel dimensions, straight from the file header - no dependencies."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker == 0xD8 or marker == 0x01 or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                          0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                return (int.from_bytes(data[i + 7:i + 9], "big"),
                        int.from_bytes(data[i + 5:i + 7], "big"))
            i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    raise SystemExit(f"build-docx: PNG or JPEG only, cannot read {path}")


def fit(w, h):
    cx, cy = w * EMU_PER_PX, h * EMU_PER_PX
    max_w = CONTENT_W * EMU_PER_DXA
    if cx > max_w:
        cy, cx = int(cy * max_w / cx), max_w
    if cy > MAX_H:
        cx, cy = int(cx * MAX_H / cy), MAX_H
    return cx, cy


def drawing(rid, idx, cx, cy, alt):
    return (f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
            f'<wp:extent cx="{cx}" cy="{cy}"/>'
            f'<wp:effectExtent l="0" t="0" r="0" b="0"/>'
            f'<wp:docPr id="{idx}" name="Picture {idx}" descr="{esc(alt)}"/>'
            f'<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/>'
            f'</wp:cNvGraphicFramePr><a:graphic>'
            f'<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:pic><pic:nvPicPr><pic:cNvPr id="{idx}" name="Picture {idx}"/>'
            f'<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="{rid}"/>'
            f'<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
            f'</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')


def shot(n, ctx):
    """<figure class="shot"> - the screenshot that names the region."""
    img = n.first("img")
    if img is None:
        return []
    src = img.attrs.get("src", "")
    if src.startswith("data:"):
        header, _, b64 = src.partition(",")
        data = base64.b64decode(b64)
        ext = ".jpg" if "jpeg" in header else ".png"
        key = hashlib.sha1(data).hexdigest()
    else:
        path = os.path.normpath(os.path.join(ctx["base"], src))
        if not os.path.exists(path):
            raise SystemExit(f"build-docx: {ctx['source']} points at a missing image: {src}")
        data, ext, key = open(path, "rb").read(), os.path.splitext(path)[1].lower(), src
    cx, cy = fit(*image_size(data, src))
    media = ctx["media"]
    if key not in media:
        media[key] = (f"image{len(media) + 1}{ext}", data)
    idx = list(media).index(key) + 1
    out = [para(drawing(f"rId{idx + 2}", idx, cx, cy, img.attrs.get("alt", "")),
                before=60, after=60)]
    cap = n.first("figcaption")
    if cap is not None:
        out.append(para("".join(inline(cap, ctx["font"], INK_FAINT, SZ["small"])),
                        before=0, after=160))
    return out


# ------------------------------------------------------------- components ---


def heading(n, ctx, num=None, meta=None):
    text = n.text()
    if num:
        text = f"{num}. {text}"
    lvl = {"h1": ("Heading1", SZ["h1"], INK), "h2": ("Heading2", SZ["h2"], EVERGREEN),
           "h3": ("Heading3", SZ["h3"], INK)}[n.tag]
    style, sz, color = lvl
    out = [para(run(text, font=SANS, b=True, color=color, sz=sz), style=style,
                before=360 if n.tag == "h2" else 0, after=120, keep=True)]
    if meta is not None:
        out.append(para(meta, before=0, after=180))
    return out


def label_p(n, color=INK_FAINT, before=200):
    return para(label_runs(n.text(), color), before=before, after=80, keep=True)


def body(n, ctx, color=INK_SOFT, sz=None, i=False):
    sz = sz or SZ["body"]
    runs = inline(n, ctx["font"], color, sz)
    if i:
        runs = [run(n.text(), font=ctx["font"], i=True, color=color, sz=sz)]
    return body_p("".join(runs))


def stripe(n, ctx):
    spans = [c for c in n.children if isinstance(c, Node)]
    lab, rest = spans[0], spans[1:]
    left = [para(label_runs(lab.text()), before=0, after=0)]
    right = [para("".join(inline(r, ctx["font"], INK_SOFT, SZ["body"])), before=0, after=0)
             for r in rest]
    return table([cell(left, 1900, shd=SURFACE2, borders=borders(RULE),
                       margins=(120, 120, 120, 180)) +
                  cell(right, CONTENT_W - 1900, shd=SURFACE2, borders=borders(RULE),
                       margins=(120, 180, 120, 120))],
                 [1900, CONTENT_W - 1900])


def cell_runs(td, ctx):
    """A table cell: its text, plus any on-page / off-page marker underneath."""
    k = td.cls
    font, color, sz, bold = ctx["font"], INK_SOFT, SZ["body"], False
    if "c-num" in k:
        font, color, sz = MONO, INK_FAINT, SZ["label"]
    elif "c-name" in k:
        font, color, bold = SANS, INK, True
    elif "c-key" in k:
        font = MONO
    marks = [c for c in td.children
             if isinstance(c, Node) and ("on-page" in c.cls or "off-page" in c.cls)]
    main = Node("span")
    main.children = [c for c in td.children if c not in marks]
    blocks = [para("".join(inline(main, font, color, sz, bold)), before=0,
                   after=40 if marks else 0)]
    for m in marks:
        blocks.append(para(label_runs(m.text(), BRASS if "on-page" in m.cls else INK_FAINT),
                           before=0, after=0))
    return blocks


def tbl(n, ctx):
    rows_html = n.find_all("tr")
    ncol = max(len(r.find_all("th")) + len(r.find_all("td")) for r in rows_html)
    widths = {2: ctx["two_col"], 3: [3500, 1900, 3960], 4: [560, 2860, 3040, 2900]}[ncol]
    rows = []
    for r in rows_html:
        cells = [c for c in r.children if isinstance(c, Node) and c.tag in ("th", "td")]
        is_head = cells and cells[0].tag == "th"
        tcs = []
        for i, c in enumerate(cells):
            if is_head:
                blocks = [para(label_runs(c.text()), before=0, after=0)]
                tcs.append(cell(blocks, widths[i], shd=SURFACE2,
                                borders=borders(RULE, sides="b")))
            else:
                first = i == 0 and ctx.get("bold_first")
                if first:
                    c.attrs["class"] = c.attrs.get("class", "") + " c-name"
                tcs.append(cell(cell_runs(c, ctx), widths[i], borders=borders(RULE, sides="b")))
        rows.append("".join(tcs))
    return table(rows, widths)


def path_runs(n, ctx):
    out = []
    for c in n.children:
        if not isinstance(c, Node):
            continue
        if "sep" in c.cls:
            out.append(run("  →  ", font=SANS, color=INK_FAINT, sz=SZ["body"]))
        elif "is-do" in c.cls:
            out.append(run(c.text(), font=SANS, b=True, color=BRASS, sz=SZ["body"]))
        elif "is-list" in c.cls:
            out.append(run(c.text(), font=SANS, b=True, color=INK, sz=SZ["body"]))
        else:
            out.append(run(c.text(), font=SANS, color=INK_SOFT, sz=SZ["body"]))
    return "".join(out)


def path_box(n, ctx, fill=SURFACE2, line=RULE_STRONG, label=None):
    blocks = []
    if label:
        blocks.append(para(label_runs(label, BRASS), before=0, after=60))
    blocks.append(para(path_runs(n, ctx), before=0, after=0))
    return boxed(blocks, fill, line)


def attach(n, ctx):
    lab = n.first("p", "label")
    path = n.first("p", "path")
    return path_box(path, ctx, BRASS_TINT, BRASS, lab.text() if lab else None)


def mf(n, ctx):
    parts = []
    for c in n.children:
        if not isinstance(c, Node):
            continue
        k = c.cls
        if "mf-label" in k:
            parts.append(label_runs(c.text()))
            parts.append(run("  ", font=SANS, sz=SZ["body"]))
        elif "mf-key" in k:
            parts.append(run(c.text(), font=MONO, b=True, color=BRASS, sz=SZ["body"]))
            parts.append(run("   ", font=SANS, sz=SZ["body"]))
        elif "mf-sep" in k:
            parts.append(run("|   ", font=SANS, color=RULE_STRONG, sz=SZ["body"]))
        elif "mf-type" in k:
            parts.append("".join(inline(c, SANS, INK, SZ["body"])))
            parts.append(run("   ", font=SANS, sz=SZ["body"]))
    return boxed([para("".join(parts), before=0, after=0)], BRASS_TINT, BRASS)


def callout(n, ctx):
    warn = "callout--warn" in n.cls or "aside--warn" in n.cls
    fill, line = (WARN_TINT, WARN) if warn else (SURFACE2, RULE_STRONG)
    blocks = []
    for c in n.children:
        if not isinstance(c, Node):
            continue
        if c.tag == "h3" or "label" in c.cls:
            blocks.append(para(label_runs(c.text(), WARN if warn else INK_FAINT),
                               before=0, after=60))
        else:
            blocks.append(para("".join(inline(c, ctx["font"], INK if warn else INK_SOFT,
                                              SZ["body"])), before=0, after=0))
    return boxed(blocks, fill, line)


def def_card(n, ctx):
    out = []
    head = n.first("div", "def-head")
    if head:
        role = head.first("span", "def-role")
        name = head.first("span", "def-name")
        out.append(para(label_runs(role.text(), BRASS) +
                        run("   ", font=SANS, sz=SZ["h3"]) +
                        run(name.text(), font=SANS, b=True, color=INK, sz=SZ["h3"]),
                        before=180, after=100, border=RULE_STRONG, keep=True))
    t = n.first("table")
    if t is not None:
        out.append(tbl(t, ctx))
    note = n.first("p", "def-note")
    if note is not None:
        out.append(para("".join(inline(note, ctx["font"], INK_SOFT, SZ["small"])),
                        before=100, after=160))
    return out


def rules(n, ctx):
    cards = n.find_all("div", "rule-card")
    w = CONTENT_W // 2
    rows, pair = [], []
    for c in cards:
        blocks = [para(run(c.first("span", "n").text(), font=MONO, color=BRASS,
                           sz=SZ["label"]), before=0, after=60),
                  para(run(c.first("b").text(), font=SANS, b=True, color=INK,
                           sz=SZ["body"]), before=0, after=60),
                  para("".join(inline(c.first("p"), ctx["font"], INK_SOFT, SZ["small"])),
                       before=0, after=0)]
        pair.append(cell(blocks, w, shd=SURFACE2, borders=borders(RULE),
                         margins=(140, 160, 140, 160)))
        if len(pair) == 2:
            rows.append("".join(pair))
            pair = []
    if pair:
        pair.append(cell([], w))
        rows.append("".join(pair))
    return [table(rows, [w, w])]


def numbered(n, ctx):
    nid = ctx["next_num"]()
    out = []
    for li in [c for c in n.children if isinstance(c, Node) and c.tag == "li"]:
        out.append(para("".join(inline(li, ctx["font"], INK_SOFT, SZ["body"])),
                        style="ListParagraph", num=nid, before=0, after=100))
    return out


def bullets(n, ctx):
    out = []
    for li in [c for c in n.children if isinstance(c, Node) and c.tag == "li"]:
        out.append(para("".join(inline(li, ctx["font"], INK_SOFT, SZ["body"])),
                        style="ListParagraph", num=1, before=0, after=80))
    return out


def steps(n, ctx):
    nid = ctx["next_num"]()
    out = []
    for s in n.find_all("div", "step"):
        out.append(para("".join(inline(s.first("p"), ctx["font"], INK_SOFT, SZ["body"])),
                        style="ListParagraph", num=nid, before=0, after=100))
    return out


def places(n, ctx):
    rows = []
    for p in n.find_all("div", "place"):
        left = [para(path_runs(p.first("p", "path"), ctx), before=0, after=0)]
        right = [para("".join(inline(p.find_all("p")[-1], ctx["font"], INK_SOFT,
                                     SZ["body"])), before=0, after=0)]
        rows.append(cell(left, 4900, shd=SURFACE2, borders=borders(RULE),
                         margins=(120, 140, 120, 160)) +
                    cell(right, CONTENT_W - 4900, shd=SURFACE2, borders=borders(RULE),
                         margins=(120, 160, 120, 140)))
    return table(rows, [4900, CONTENT_W - 4900])


def index_tbl(n, ctx):
    cards = n.find_all("a")
    has_row = any(c.first("span", "row") is not None for c in cards)
    heads = ["#", "Part of the page", "Metaobject list to open"]
    ws = [600, 3100, 2900, CONTENT_W - 6600] if has_row else [700, 4200, CONTENT_W - 4900]
    if has_row:
        heads.append("Metafield row to attach it to")
    rows = ["".join(cell([para(label_runs(h), before=0, after=0)], ws[i], shd=SURFACE2,
                         borders=borders(RULE, sides="b"))
                    for i, h in enumerate(heads))]
    for a in cards:
        def txt(cls):
            got = a.first("span", cls)
            return got.text().split(": ", 1)[-1] if got is not None else ""
        cells = [
            cell([para(run(txt("n"), font=SANS, b=True, color=BRASS, sz=SZ["body"]),
                       before=0, after=0)], ws[0], borders=borders(RULE, sides="b")),
            cell([para(run(txt("what"), font=SANS, b=True, color=INK, sz=SZ["body"]),
                       before=0, after=0)], ws[1], borders=borders(RULE, sides="b")),
            cell([para(run(txt("list"), font=ctx["font"], color=INK_SOFT, sz=SZ["body"]),
                       before=0, after=0)], ws[2], borders=borders(RULE, sides="b")),
        ]
        if has_row:
            cells.append(cell([para(run(txt("row"), font=ctx["font"], color=INK_SOFT,
                                        sz=SZ["body"]), before=0, after=0)], ws[3],
                              borders=borders(RULE, sides="b")))
        rows.append("".join(cells))
    return table(rows, ws)


def code(n, ctx):
    head = n.first("span")
    pre = n.first("pre")
    blocks = []
    if head is not None:
        blocks.append(para(label_runs(head.text()), before=0, after=80))
    for ln in pre.raw().strip("\n").split("\n"):
        blocks.append(para(run(ln.rstrip() or " ", font=MONO, color=INK, sz=SZ["small"]),
                           before=0, after=0, line=240))
    return boxed(blocks, SURFACE2, RULE_STRONG)


# ----------------------------------------------------------------- walker ---


def walk(node, ctx):
    out = []
    for c in node.children:
        if isinstance(c, Node):
            out.extend(emit(c, ctx))
    return out


def emit(n, ctx):
    k, t = n.cls, n.tag
    if t == "nav" or "rail" in k or t in ("script", "style"):
        return []
    if t == "figure" and "shot" in k:
        return shot(n, ctx)
    if t == "table":
        return [tbl(n, ctx)]
    if "stripe" in k:
        return [stripe(n, ctx)]
    if "rules" in k:
        return rules(n, ctx)
    if "mf" in k and t == "div":
        return [mf(n, ctx)]
    if "attach" in k:
        return [attach(n, ctx)]
    if "callout" in k or "aside" in k:
        return [callout(n, ctx)]
    if "code-card" in k:
        return [code(n, ctx)]
    if "checklist" in k or "fixes" in k:
        return numbered(n, ctx)
    if "plain" in k:
        return bullets(n, ctx)
    if "index" in k:
        return [index_tbl(n, ctx)]
    if "steps" in k:
        return steps(n, ctx)
    if "places" in k:
        return [places(n, ctx)]
    if "def" in k and t == "div":
        return def_card(n, ctx)
    if "feature-head" in k or "part-head" in k:
        num = n.first("span", "feature-num") or n.first("span", "part-n")
        h = n.first("h2")
        meta = n.first("p", "feature-meta") or n.first("p", "looks")
        meta_runs = None
        if meta is not None:
            small = "feature-meta" in meta.cls
            meta_runs = "".join(inline(meta, ctx["font"], INK_FAINT if small else INK_SOFT,
                                       SZ["small"] if small else SZ["body"]))
        return heading(h, ctx, num=num.text() if num else None, meta=meta_runs)
    if t in ("h1", "h2", "h3"):
        return heading(n, ctx)
    if t == "p":
        if "kicker" in k or "block-label" in k or "label" in k:
            return [label_p(n)]
        if "path" in k:
            return [path_box(n, ctx)]
        if "def-note" in k or "footnote" in k or "closing" in k:
            return [body(n, ctx, color=INK_FAINT, sz=SZ["small"])]
        return [body(n, ctx)]
    return walk(n, ctx)


def counter(start=2):
    box = [start - 1]

    def nxt():
        box[0] += 1
        return box[0]
    return nxt


def masthead(root, ctx):
    head = root.first("header", "masthead")
    eyebrow = head.first("p", "eyebrow") or head.first("span", "label")
    out = [para(label_runs(eyebrow.text(), BRASS), before=0, after=140)]
    out += heading(head.first("h1"), ctx)
    for p in head.find_all("p"):
        if p is eyebrow or "eyebrow" in p.cls:
            continue
        out.append(body(p, ctx, sz=SZ["body"]))
    for st in head.find_all("div", "stripe"):
        out.append(stripe(st, ctx))
        out.append(gap(120))
    return out


def build(html_path, docx_path, title, font, two_col, bold_first):
    root = parse(html_path)
    ctx = {"font": font, "two_col": two_col, "bold_first": bold_first,
           "next_num": counter(), "media": {}, "base": os.path.dirname(html_path),
           "source": os.path.basename(html_path)}
    blocks = masthead(root, ctx)
    blocks.append(gap(240))
    blocks += walk(root.first("main"), ctx)
    foot = root.first("footer", "colophon")
    if foot is not None:
        blocks.append(gap(200))
        blocks.append(para("".join(run(s.text() + "     ", font=SANS, color=INK_FAINT,
                                       sz=SZ["label"])
                                   for s in foot.find_all("span")),
                           border=RULE_STRONG, before=200, after=0))
    write_docx(docx_path, blocks, title, list(ctx["media"].values()))
    return docx_path


# ---------------------------------------------------------------- package ---

SECT = ('<w:sectPr><w:pgSz w:w="12240" w:h="15840" w:orient="portrait"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
        'w:header="708" w:footer="708" w:gutter="0"/><w:docGrid w:linePitch="360"/>'
        '</w:sectPr>')

NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')

DRAW_NS = (' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/'
           'wordprocessingDrawing"'
           ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
           ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')

XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'


def styles_xml():
    def heading_style(sid, name, lvl, sz, color, before, after):
        return (f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{name}"/>'
                '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'
                f'<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="{before}" '
                f'w:after="{after}"/><w:outlineLvl w:val="{lvl}"/></w:pPr>'
                f'<w:rPr><w:rFonts w:ascii="{SANS}" w:hAnsi="{SANS}"/><w:b/>'
                f'<w:color w:val="{color}"/><w:sz w:val="{sz}"/>'
                f'<w:szCs w:val="{sz}"/></w:rPr></w:style>')
    return XML + f'<w:styles {NS}>' + (
        f'<w:docDefaults><w:rPrDefault><w:rPr>'
        f'<w:rFonts w:ascii="{SANS}" w:hAnsi="{SANS}" w:cs="{SANS}"/>'
        f'<w:color w:val="{INK}"/><w:sz w:val="{SZ["body"]}"/>'
        f'<w:szCs w:val="{SZ["body"]}"/></w:rPr></w:rPrDefault>'
        '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" '
        'w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
        '<w:name w:val="Normal"/></w:style>'
        + heading_style("Heading1", "heading 1", 0, SZ["h1"], INK, 0, 200)
        + heading_style("Heading2", "heading 2", 1, SZ["h2"], EVERGREEN, 360, 140)
        + heading_style("Heading3", "heading 3", 2, SZ["h3"], INK, 240, 120)
        + '<w:style w:type="paragraph" w:styleId="ListParagraph">'
          '<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>'
          '<w:pPr><w:ind w:left="440"/><w:contextualSpacing/></w:pPr></w:style>'
        '<w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/>'
        '<w:rPr><w:b/></w:rPr></w:style>'
    ) + '</w:styles>'


def numbering_xml(decimals=14):
    def lvl(fmt, text):
        return ('<w:lvl w:ilvl="0"><w:start w:val="1"/>'
                f'<w:numFmt w:val="{fmt}"/><w:lvlText w:val="{text}"/>'
                '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="440" w:hanging="320"/></w:pPr>'
                + ('<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/>'
                   '</w:rPr>' if fmt == "bullet" else
                   f'<w:rPr><w:rFonts w:ascii="{SANS}" w:hAnsi="{SANS}"/><w:b/>'
                   f'<w:color w:val="{BRASS}"/></w:rPr>')
                + '</w:lvl>')
    out = [XML, f'<w:numbering {NS}>']
    out.append('<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>'
               + lvl("decimal", "%1.") + '</w:abstractNum>')
    out.append('<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>'
               + lvl("bullet", "") + '</w:abstractNum>')
    out.append('<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>')
    for i in range(2, decimals + 2):
        out.append(f'<w:num w:numId="{i}"><w:abstractNumId w:val="0"/></w:num>')
    out.append('</w:numbering>')
    return "".join(out)


def normalize(blocks):
    """Word merges two tables that touch, so keep a paragraph between them,
    and never end the body on a table."""
    out = []
    for b in blocks:
        if b.startswith("<w:tbl") and out and out[-1].rstrip().endswith("</w:tbl>"):
            out.append(gap(140))
        out.append(b)
    if out and out[-1].rstrip().endswith("</w:tbl>"):
        out.append(gap(140))
    return out


def write_docx(path, blocks, title, media=None):
    media = media or []
    doc = (XML + f'<w:document {NS}{DRAW_NS if media else ""}><w:body>'
           + "".join(normalize(blocks)) + SECT + '</w:body></w:document>')
    core = (XML + '<cp:coreProperties '
            'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/">'
            f'<dc:title>{esc(title)}</dc:title>'
            '<dc:creator>Golden theme</dc:creator>'
            '<cp:lastModifiedBy>Golden theme</cp:lastModifiedBy>'
            '</cp:coreProperties>')
    app = (XML + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/'
           '2006/extended-properties"><Application>Golden theme docs build</Application>'
           '</Properties>')
    ctypes = (XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/'
              'content-types"><Default Extension="rels" ContentType="application/'
              'vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="xml" ContentType="application/xml"/>'
              '<Override PartName="/word/document.xml" ContentType="application/vnd.'
              'openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
              '<Override PartName="/word/styles.xml" ContentType="application/vnd.'
              'openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
              '<Override PartName="/word/numbering.xml" ContentType="application/vnd.'
              'openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
              '<Override PartName="/docProps/core.xml" ContentType="application/vnd.'
              'openxmlformats-package.core-properties+xml"/>'
              '<Override PartName="/docProps/app.xml" ContentType="application/vnd.'
              'openxmlformats-officedocument.extended-properties+xml"/>'
              + "".join(f'<Default Extension="{ext}" ContentType="image/{mime}"/>'
                        for ext, mime in sorted({
                            (os.path.splitext(n)[1].lstrip(".").lower(),
                             "jpeg" if os.path.splitext(n)[1].lower() in (".jpg", ".jpeg")
                             else "png")
                            for n, _ in media}))
              + '</Types>')
    rels = (XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
            'relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.'
            'org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/'
            'relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/'
            '2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
    drels = (XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
             'relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
             'officeDocument/2006/relationships/styles" Target="styles.xml"/>'
             '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/'
             '2006/relationships/numbering" Target="numbering.xml"/>'
             + "".join(f'<Relationship Id="rId{i + 3}" Type="http://schemas.'
                       f'openxmlformats.org/officeDocument/2006/relationships/image" '
                       f'Target="media/{name}"/>' for i, (name, _) in enumerate(media))
             + '</Relationships>')

    parts = [("[Content_Types].xml", ctypes), ("_rels/.rels", rels),
             ("word/document.xml", doc), ("word/_rels/document.xml.rels", drels),
             ("word/styles.xml", styles_xml()), ("word/numbering.xml", numbering_xml()),
             ("docProps/core.xml", core), ("docProps/app.xml", app)]
    parts += [(f"word/media/{name}", data) for name, data in media]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts:
            # fixed timestamp: an unchanged guide rebuilds to a byte-identical file,
            # so git only sees a diff when the content actually changed
            info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)


# ---------------------------------------------------------------- inlining ---

BIG = 600_000


def inline_images(path):
    """Bake every images/... reference into the file as a data URI.

    A guide is handed to a client as one file. A relative src would arrive
    broken, so the pixels travel inside the HTML the same way they travel
    inside the .docx.
    """
    s = open(path, encoding="utf-8").read()
    base, done = os.path.dirname(path), []

    def swap(m):
        src = m.group(2)
        if src.startswith("data:"):
            return m.group(0)
        f = os.path.normpath(os.path.join(base, src))
        if not os.path.exists(f):
            raise SystemExit(f"build-docx: {os.path.basename(path)} points at a "
                             f"missing image: {src}")
        data = open(f, "rb").read()
        mime = "jpeg" if f.lower().endswith((".jpg", ".jpeg")) else "png"
        done.append((src, len(data)))
        return f'{m.group(1)}data:image/{mime};base64,{base64.b64encode(data).decode()}"'

    out = re.sub(r'(<img[^>]*?\ssrc=")([^"]+)"', swap, s)
    if done:
        open(path, "w", encoding="utf-8").write(out)
        for src, size in done:
            note = ""
            if size > BIG:
                note = (f"  <- {size // 1024}KB, downscale it: "
                        f"sips -Z 1600 docs/{src} --out docs/{src}")
            print(f"    inlined {src}{note}")
    return len(done)


# ------------------------------------------------------------------- main ---

KINDS = {
    "developer-setup": (SANS, [3200, 6160], False),
    "content-guide": (SERIF, [2700, 6660], True),
}


def meta(head, name):
    m = re.search(rf'<meta\s+name="{name}"\s+content="([^"]*)"', head)
    return m.group(1) if m else ""


def discover():
    """Every guide in docs/ declares what it is and what to call its Word copy."""
    for f in sorted(os.listdir(HERE)):
        if not f.endswith(".html"):
            continue
        path = os.path.join(HERE, f)
        with open(path, encoding="utf-8") as fh:
            head = fh.read(4096)
        kind, name = meta(head, "guide-kind"), meta(head, "docx-name")
        if kind in KINDS and name:
            yield path, os.path.join(HERE, name + ".docx"), name, kind


def main():
    found = list(discover())
    if not found:
        print("No guides in docs/ - a guide pair is written when a section or "
              "block is built against metafields.")
        return
    for html_path, docx_path, title, kind in found:
        font, two_col, bold_first = KINDS[kind]
        inline_images(html_path)
        build(html_path, docx_path, title, font, two_col, bold_first)
        print(f"wrote {os.path.basename(docx_path)} "
              f"({os.path.getsize(docx_path):,} bytes) from {os.path.basename(html_path)}")


if __name__ == "__main__":
    main()
