"""
Construit les images du mod Pac-Man à partir des dessins sources (fond blanc).

    python build_images.py        (nécessite Pillow : pip install pillow)

Entrées  (ce dossier)  : sheet0.jpg, sheet1.jpg, hub.jpg, portrait.jpg
Sorties  (dossier parent) : heros/<anim>_<frame>.png, hub_0.png, hub_1.png, portrait.png, manifest.json

sheet1.jpg reprend exactement la disposition de images/heros-sheet1.png (le chevalier) à l'échelle x2 :
les frames du chevalier venant de heros-sheet1 y sont donc découpées aux mêmes coordonnées x2.
Les autres frames (heros-sheet0 et autres planches) utilisent les poses de sheet0.jpg listées dans POSES.
"""
import json
import os
from collections import deque

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

# Frames de l'objet "heros" du jeu : anim, frame, planche, x, y, largeur, hauteur
CHEVALIER = """
idle 0 s1 280 257 64 139|idle 1 s1 413 1 64 139|idle 2 s1 347 1 64 139|idle 3 s1 213 1 65 138|idle 4 s0 949 373 68 136
idle 5 s1 280 1 65 137|idle 6 s1 213 141 64 134|idle 7 s1 411 257 63 134|idle 8 s1 346 257 63 135|idle 9 s0 709 448 63 137
attack 0 s0 165 1 163 162|attack 1 s0 484 1 153 171|attack 2 s0 793 1 152 172|attack 3 s0 897 175 113 196
attack 4 s0 303 339 115 127|attack 5 s0 601 385 118 106|attack 6 s0 420 385 119 105
hurt 0 s0 1 1 163 162|hurt 1 s0 329 1 153 171|hurt 2 s0 639 1 152 172|hurt 3 s0 769 175 113 196|hurt 4 s0 161 166 152 164
hurt 5 s0 1 166 158 165|hurt 6 s0 315 174 143 163|hurt 7 s0 161 166 152 164|hurt 8 s0 1 166 158 165|hurt 9 s0 315 174 143 163
open 0 s1 1 385 74 99|open 1 s1 77 385 73 99|open 2 s1 152 385 73 96|open 3 s1 70 1 67 183|open 4 s0 709 373 73 169
open 5 s1 139 1 72 167|open 6 s0 880 373 67 138
openHeal 0 s1 1 385 74 99|openHeal 1 s1 77 385 73 99|openHeal 2 s1 152 385 73 96|openHeal 3 s1 1 1 67 183
openHeal 4 s0 947 1 73 169|openHeal 5 s0 527 343 72 167|openHeal 6 s0 880 373 67 138
piques_idle 0 x 0 0 132 147|piques_idle 1 x 0 0 128 145|piques_idle 2 x 0 0 127 135|piques_idle 3 x 0 0 127 134
piques_idle 4 x 0 0 130 131|piques_idle 5 x 0 0 126 123|piques_idle 6 x 0 0 143 117
hurt2 0 s0 1 333 160 113|hurt2 1 s0 460 174 167 139|hurt2 2 s0 601 175 163 140|hurt2 3 s0 161 332 140 150
piques_hurt 0 s0 1 333 160 113|piques_hurt 1 s0 460 174 167 139|piques_hurt 2 s0 601 175 163 140|piques_hurt 3 s0 161 332 140 150
bounce 0 x 0 0 56 64
"""

# Poses de sheet0.jpg (zone approximative, recadrée automatiquement sur le dessin)
POSES = {
    "idle":        ("sheet1", (560, 514, 688, 792)),   # = idle 0 du chevalier x2
    "bras_leves":  ("sheet1", (278, 2, 422, 336)),     # = open 5 du chevalier x2
    "etoiles":     ("sheet0", (10, 366, 138, 560)),    # contour blanc + étoiles
    "etoiles_rouge": ("sheet0", (138, 366, 306, 560)),
    "rouge_bras":  ("sheet0", (306, 370, 404, 560)),   # silhouette rouge bras levés
    "course":      ("sheet0", (142, 552, 363, 782)),
    "dash":        ("sheet0", (645, 318, 861, 548)),
    "eclat_jaune": ("sheet0", (8, 556, 136, 780)),
    "eclat_rouge": ("sheet0", (406, 566, 542, 782)),
    "vertige":     ("sheet0", (4, 776, 158, 1004)),    # silhouette rouge + spirales
    "dessus_choc": ("sheet0", (563, 786, 778, 1008)),  # vu de dessus avec lignes d'impact
    "dessus":      ("sheet0", (784, 786, 1008, 1008)),
}

# Frame du chevalier (hors heros-sheet1) -> pose de Pac-Man
MAPPING = {
    ("idle", 4): "idle", ("idle", 9): "idle",
    ("attack", 0): "dash", ("attack", 1): "course", ("attack", 2): "course", ("attack", 3): "dash",
    ("attack", 4): "dessus_choc", ("attack", 5): "dessus", ("attack", 6): "dessus",
    ("hurt", 0): "dash", ("hurt", 1): "course", ("hurt", 2): "course", ("hurt", 3): "dash",
    ("hurt", 4): "etoiles_rouge", ("hurt", 5): "etoiles", ("hurt", 6): "rouge_bras",
    ("hurt", 7): "etoiles_rouge", ("hurt", 8): "etoiles", ("hurt", 9): "rouge_bras",
    ("open", 4): "blanc_bras", ("open", 6): "idle",
    ("openHeal", 3): "bras_leves", ("openHeal", 4): "rouge_bras", ("openHeal", 5): "bras_leves", ("openHeal", 6): "idle",
    ("piques_idle", 0): "dash", ("piques_idle", 1): "course", ("piques_idle", 2): "dash", ("piques_idle", 3): "course",
    ("piques_idle", 4): "dash", ("piques_idle", 5): "dessus_choc", ("piques_idle", 6): "dessus",
    ("hurt2", 0): "eclat_rouge", ("hurt2", 1): "eclat_jaune", ("hurt2", 2): "vertige", ("hurt2", 3): "course",
    ("piques_hurt", 0): "eclat_rouge", ("piques_hurt", 1): "eclat_jaune", ("piques_hurt", 2): "vertige", ("piques_hurt", 3): "course",
    ("bounce", 0): "dessus",
}


def remove_white(img, threshold=228):
    return remove_background(img, threshold=threshold)


def remove_background(img, threshold=228, dark=False):
    """Fond uni -> transparent, par remplissage depuis les bords (les gants blancs entourés de noir restent).
    dark=True : fond noir au lieu de blanc."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i]:
            continue
        r, g, b, _ = px[x, y]
        if (max(r, g, b) > 45) if dark else (min(r, g, b) < threshold):
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if bg[i]:
                px[x, y] = (0, 0, 0, 0)
            else:
                # liseré clair (artefacts JPEG) au contact du fond : transparence progressive
                near = (x > 0 and bg[i - 1]) or (x < w - 1 and bg[i + 1]) or (y > 0 and bg[i - w]) or (y < h - 1 and bg[i + w])
                if near:
                    r, g, b, _ = px[x, y]
                    lum = (r + g + b) / 3
                    if dark and lum < 90:
                        px[x, y] = (r, g, b, int(255 * lum / 90))
                    elif not dark and lum > 150:
                        px[x, y] = (r, g, b, int(255 * max(0.0, (255 - lum) / 105)))
    return img


HAND_ANIMS = ("ouverte", "fermee", "agitation", "ecrase", "nop", "doigt")


def game_frames(obj_name, anims):
    """Taille des frames d'un objet du jeu, lue dans data.json : [(anim, frame, largeur, hauteur)]."""
    data = json.load(open(os.path.join(OUT, "..", "..", "data.json"), encoding="utf-8"))
    for o in data["project"][3]:
        if o[0] == obj_name:
            return [(a[0], i, f[4], f[5]) for a in o[7] if a[0] in anims for i, f in enumerate(a[7])]
    raise KeyError(obj_name)


def largest_part(img):
    """Ne garde que le plus grand morceau de dessin (enlève les débris autour)."""
    w, h = img.size
    alpha = img.getchannel("A").load()
    seen = bytearray(w * h)
    best = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or alpha[sx, sy] < 30:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and alpha[nx, ny] >= 30:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = Image.new("L", (w, h), 0)
    kp = keep.load()
    for x, y in best:
        kp[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(3))
    out = img.copy()
    out.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (w, h), 0), keep))
    return trim(out)


def trim(img):
    box = img.getbbox()
    return img.crop(box) if box else img


def extract(sheet, box, margin=50, min_area=25):
    """Découpe une pose : garde les morceaux de dessin dont le centre est dans la zone (pas ceux des voisines)."""
    x0, y0, x1, y1 = box
    X0, Y0 = max(0, x0 - margin), max(0, y0 - margin)
    X1, Y1 = min(sheet.width, x1 + margin), min(sheet.height, y1 + margin)
    img = sheet.crop((X0, Y0, X1, Y1))
    w, h = img.size
    alpha = img.getchannel("A").load()
    seen = bytearray(w * h)
    keep = Image.new("L", (w, h), 0)
    kp = keep.load()
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or alpha[sx, sy] < 30:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and alpha[nx, ny] >= 30:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            cx = sum(p[0] for p in comp) / len(comp) + X0
            cy = sum(p[1] for p in comp) / len(comp) + Y0
            if len(comp) >= min_area and x0 <= cx < x1 and y0 <= cy < y1:
                for x, y in comp:
                    kp[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(3))      # récupère le liseré semi-transparent
    out = img.copy()
    out.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (w, h), 0), keep))
    return trim(out)


def fit(pose, w, h, scale=0.95):
    """Place la pose dans un cadre w x h (contenue, centrée, posée en bas)."""
    k = min(w / pose.width, h / pose.height) * scale
    p = pose.resize((max(1, round(pose.width * k)), max(1, round(pose.height * k))), Image.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(p, ((w - p.width) // 2, h - p.height - round(h * (1 - scale) / 2)))
    return out


def recolor(img, rgb):
    r, g, b = rgb
    a = img.getchannel("A")
    out = Image.new("RGBA", img.size, (r, g, b, 255))
    out.putalpha(a)
    return out


def outline_in_place(img, size, rgb=(255, 255, 255)):
    """Contour coloré autour du dessin, sans changer la taille de l'image (il faut une marge transparente)."""
    a = img.getchannel("A").point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(size * 2 + 1))
    ring = Image.new("RGBA", img.size, rgb + (255,))
    ring.putalpha(a)
    ring.alpha_composite(img)
    return ring


def outline(img, size, rgb):
    """Ajoute un contour coloré autour du dessin (effet "survol" du hub)."""
    pad = size + 2
    big = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    big.alpha_composite(img, (pad, pad))
    a = big.getchannel("A").point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(size * 2 + 1))
    ring = Image.new("RGBA", big.size, rgb + (255,))
    ring.putalpha(a)
    ring.alpha_composite(big)
    return ring


def main():
    sheets = {n: Image.open(os.path.join(HERE, n + ".jpg")).convert("RGB") for n in ("sheet0", "sheet1")}
    clean = {n: remove_white(im) for n, im in sheets.items()}

    poses = {}
    for name, (sheet, box) in POSES.items():
        poses[name] = extract(clean[sheet], box)
    poses["blanc_bras"] = recolor(poses["rouge_bras"], (255, 255, 255))

    os.makedirs(os.path.join(OUT, "heros"), exist_ok=True)
    manifest = {"heros": []}
    for entry in CHEVALIER.replace("\n", "|").split("|"):
        if not entry.strip():
            continue
        anim, frame, sheet, x, y, w, h = entry.split()
        frame, x, y, w, h = int(frame), int(x), int(y), int(w), int(h)
        if anim == "idle":
            # repos : les 10 frames identiques (pose idle 0) ; la respiration est animée en douceur par le mod
            sheet, x, y, w, h = "s1", 280, 257, 64, 139
        if sheet == "s1":
            # même disposition que heros-sheet1.png, à l'échelle x2
            img = clean["sheet1"].crop((x * 2, y * 2, (x + w) * 2, (y + h) * 2)).resize((w, h), Image.LANCZOS)
            if img.getbbox() is None:   # zone vide dans le dessin : on prend la pose de repos
                img = fit(poses["idle"], w, h)
        else:
            img = fit(poses[MAPPING[(anim, frame)]], w, h)
        name = f"heros/{anim}_{frame}.png"
        img.save(os.path.join(OUT, name))
        manifest["heros"].append({"anim": anim, "frame": frame, "file": name})

    # hub : 4 images de même taille, figures alignées à gauche et en bas
    #   hub_0 normal, hub_1 survol (contour blanc), hub_2 sélectionné (tient la lanterne), hub_3 sélectionné + survol
    def hub_figure(name):
        img = remove_white(Image.open(os.path.join(HERE, name)))
        box = img.getbbox()
        img = img.crop(box)
        k = 300 / img.height
        return img.resize((round(img.width * k), 300), Image.LANCZOS), box, k
    normal, _, _ = hub_figure("hub.jpg")
    lantern, lbox, lk = hub_figure("hub_lanterne.jpg")
    PAD = 8
    W, H = max(normal.width, lantern.width) + 2 * PAD, 300 + 2 * PAD
    def on_canvas(fig):
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        c.alpha_composite(fig, (PAD, PAD))
        return c
    hubs = [on_canvas(normal), None, on_canvas(lantern), None]
    hubs[1], hubs[3] = outline_in_place(hubs[0], 5), outline_in_place(hubs[2], 5)
    manifest["hub"] = []
    for i, img in enumerate(hubs):
        img.save(os.path.join(OUT, f"hub_{i}.png"))
        manifest["hub"].append(f"hub_{i}.png")
    # point "lanterne" (où le jeu place la lueur) : centre du verre de la lanterne dans hub_lanterne.jpg
    LANTERNE_SRC = (860, 670)
    lx = ((LANTERNE_SRC[0] - lbox[0]) * lk + PAD) / W
    ly = ((LANTERNE_SRC[1] - lbox[1]) * lk + PAD) / H
    manifest["lanterne"] = [round(lx, 4), round(ly, 4)]

    # portrait de l'interface : 206 x 384, fond noir.
    # portrait_final.png (retouché à la main) est utilisé tel quel ; sinon il est fabriqué depuis portrait.jpg
    final = os.path.join(HERE, "portrait_final.png")
    if os.path.exists(final):
        Image.open(final).convert("RGBA").resize((206, 384), Image.LANCZOS).save(os.path.join(OUT, "portrait.png"))
    else:
        src = Image.open(os.path.join(HERE, "portrait.jpg")).convert("RGB")
        W = src.width
        H = round(W * 384 / 206)
        top = 1290 - H                      # le bas du cadre s'arrête au-dessus des icônes de stats
        crop = remove_white(src.crop((0, top, W, top + H)))
        px = crop.load()
        for yy in range(crop.height):       # efface la pastille "?" et la bande de pierre
            for xx in range(crop.width):
                gy = yy + top
                if (xx < 175 and 1115 < gy < 1285) or gy >= 1286:
                    px[xx, yy] = (0, 0, 0, 0)
        portrait = Image.new("RGBA", crop.size, (0, 0, 0, 255))
        portrait.alpha_composite(crop)
        portrait.resize((206, 384), Image.LANCZOS).save(os.path.join(OUT, "portrait.png"))
    manifest["portrait"] = "portrait.png"

    # bras de la boutique (heros_bras, 169 x 635 chez le chevalier) : dessin sur fond noir
    arm = remove_background(Image.open(os.path.join(HERE, "arm.jpg")), dark=True)
    arm = trim(arm)
    arm.resize((round(arm.width * 635 / arm.height), 635), Image.LANCZOS).save(os.path.join(OUT, "arm.png"))
    manifest["bras"] = "arm.png"

    # silhouette blanche de la chute après la mort (heros_mort, 140 x 150)
    fit(poses["blanc_bras"], 140, 150).save(os.path.join(OUT, "mort.png"))
    manifest["mort"] = "mort.png"

    # main gantée (heros_main) : remplace les poses "génériques" (utilisées par Pac-Man faute de version "_pacman")
    #   main ouverte (hand_open.jpg) = main de base ; poing (hand.jpg) pour la main fermée, "non" et le doigt
    fist = largest_part(remove_background(Image.open(os.path.join(HERE, "hand.jpg")), threshold=212))
    open_hand = largest_part(remove_background(Image.open(os.path.join(HERE, "hand_open.jpg")), threshold=212))
    os.makedirs(os.path.join(OUT, "main"), exist_ok=True)
    manifest["main"] = []
    for anim, frame, w, h in game_frames("heros_main", HAND_ANIMS):
        name = f"main/{anim}_{frame}.png"
        is_open = anim in ("ouverte", "agitation", "ecrase") or (anim == "fermee" and frame == 0)
        fit(open_hand if is_open else fist, w, h, scale=0.97).save(os.path.join(OUT, name))
        manifest["main"].append({"anim": anim, "frame": frame, "file": name})

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    print("OK :", len(manifest["heros"]), "frames du héros, hub, portrait")


if __name__ == "__main__":
    main()
