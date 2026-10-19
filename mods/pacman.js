// =====================================================================
//  Mod : Pac-Man, nouveau héros jouable
//  - données : colonne 8 de tableau_persos + textes (lignes 34-37 de tableau_textesPersos)
//  - hub : un nouveau perso cliquable (meta_perso, animation inutilisée "Animation 8")
//  - images dessinées : dossier mods/pacman (générées depuis mods/pacman/sources par build_images.py)
//  - en jeu : frames de Pac-Man posées sur heros_paysan (synchronisé par le jeu), portrait, silhouette de
//    mort, trainée ; illustration de game over et schéma du miroir dessinés par code
//  - pouvoir "Super Pac-Gomme" : tous les monstres perdent 1 de puissance
//  - talent "Glouton" : vaincre un monstre peut rendre 1 PV
// =====================================================================
"use strict";
(function () {
	const M = SolCestoMods;
	const IMG = M.images;

	const HERO = {
		nom: "pacman",          // valeur de heros_nom
		numero: 8,              // colonne dans tableau_persos (= heros_numero)
		textRow: 34,            // première ligne libre dans tableau_textesPersos
		metaProgCaseY: 3,       // ligne de sauvegarde du talent (partagée avec le chevalier)
		pouvoir: "pacgomme",
		hubPos: [1640, 2065],   // position dans le calque "persos" du hub
		hubScale: 0.88          // taille du perso dans le hub
	};

	const CONFIG = {
		vieMax: 5, force: 2, magie: 1, inventaireMax: 2,
		objets: ["potion"],
		actionsPourRecharger: 4,
		debuffPouvoir: 1,       // malus de puissance infligé aux monstres
		chanceSoinTalent: 0.25  // chance de rendre 1 PV en battant un monstre
	};

	const TEXTES = {
		fr: [
			"Pac-Man",
			"Échappé de son labyrinthe, il a suivi l'odeur des pac-gommes jusqu'au fond du donjon. Il a toujours faim...",
			"Super Pac-Gomme ! Tous les monstres sont effrayés et perdent " + CONFIG.debuffPouvoir + " de puissance.",
			"Glouton : vaincre un monstre peut lui rendre 1 point de vie. Waka waka !"
		],
		en: [
			"Pac-Man",
			"Escaped from his maze, he followed the smell of pac-dots down to the bottom of the dungeon. He is always hungry...",
			"Power Pellet! All monsters get scared and lose " + CONFIG.debuffPouvoir + " power.",
			"Glutton: defeating a monster may restore 1 health point. Waka waka!"
		]
	};

	// ------------------------------------------------------------------
	// 1. Données
	// ------------------------------------------------------------------
	M.patchJson("tableau_persos.json", d => {
		const x = HERO.numero, r = HERO.textRow;
		const set = (y, v) => M.c2set(d, x, y, v);
		set(2, "Pacman");
		set(3, r); set(4, r + 1); set(5, r + 2);
		set(6, CONFIG.actionsPourRecharger);
		set(7, CONFIG.vieMax); set(8, CONFIG.force); set(9, CONFIG.magie);
		set(10, CONFIG.inventaireMax);
		for (let i = 0; i < 6; i++) set(11 + i, CONFIG.objets[i] || "");
		set(25, HERO.pouvoir);
		set(26, r + 3);
	});

	M.patchJson("tableau_textesPersos.json", d => {
		const [W] = d.size;
		for (let x = 2; x < W; x++) {
			const lang = d.data[x][2][0];
			if (!lang) continue;
			const t = lang === "FR" ? TEXTES.fr : TEXTES.en;
			for (let i = 0; i < 4; i++) d.data[x][HERO.textRow + i][0] = t[i];
		}
		d.data[0][HERO.textRow][0] = d.data[0][HERO.textRow + 1][0] = "Pacman";
	});

	// ------------------------------------------------------------------
	// 2. Dessin de Pac-Man (style du jeu : aplats, gros contour, grain pointillé)
	// ------------------------------------------------------------------
	const COL = { jaune: "#ecc94b", ombre: "#c98f2b", reflet: "#fbedb0", trait: "#1d1412", rouge: "#e05a4c", grain: "#8a5a1c" };

	// opts : mouth (demi-angle d'ouverture en radians), rot (rotation), flip (regarde à gauche),
	//        hurt, glow, silhouette (blanc uni), scared (sourcil + goutte), lw (épaisseur du trait)
	function paintPacman(g, cx, cy, r, opts = {}) {
		const m = opts.mouth ?? 0.6;
		const lw = opts.lw || Math.max(3, r * 0.1);
		g.save();
		g.translate(cx, cy);
		g.rotate(opts.rot || 0);
		if (opts.flip) g.scale(-1, 1);

		const body = () => {
			g.beginPath();
			if (m > 0.02) { g.moveTo(0, 0); g.arc(0, 0, r, m, Math.PI * 2 - m); g.closePath(); }
			else g.arc(0, 0, r, 0, Math.PI * 2);
		};

		if (opts.silhouette) {
			body(); g.fillStyle = "#fff"; g.fill();
			g.restore(); return;
		}
		if (opts.glow) {
			g.save(); g.shadowColor = "#fff6c0"; g.shadowBlur = r * 0.35;
			body(); g.fillStyle = COL.jaune; g.fill(); g.restore();
		}

		body(); g.fillStyle = opts.hurt ? COL.rouge : COL.jaune; g.fill();
		g.save(); body(); g.clip();
		// ombre en croissant
		g.fillStyle = opts.hurt ? "#b9372d" : COL.ombre;
		g.beginPath(); g.arc(-r * 0.25, -r * 0.3, r * 1.25, 0, Math.PI * 2); g.arc(0, 0, r * 2, 0, Math.PI * 2, true); g.fill("evenodd");
		// grain pointillé, plus dense dans l'ombre (bas-droite)
		let seed = 7;
		const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
		g.fillStyle = opts.hurt ? "#7d2019" : COL.grain;
		for (let i = 0; i < 260; i++) {
			const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
			const px = Math.cos(a) * d, py = Math.sin(a) * d;
			const shade = (px + py) / (2 * r) + 0.35;
			if (rnd() < shade * 0.9) { g.beginPath(); g.arc(px, py, r * 0.018 + rnd() * r * 0.012, 0, Math.PI * 2); g.fill(); }
		}
		// reflet
		g.fillStyle = opts.hurt ? "#ffb3a8" : COL.reflet;
		g.beginPath(); g.ellipse(-r * 0.45, -r * 0.5, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); g.fill();
		g.restore();

		// contour
		body(); g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = lw; g.strokeStyle = COL.trait; g.stroke();

		// oeil
		const ex = r * 0.12, ey = -r * 0.5;
		if (opts.hurt) {
			const s = r * 0.12;
			g.lineWidth = lw * 0.8;
			g.beginPath(); g.moveTo(ex - s, ey - s); g.lineTo(ex + s, ey + s); g.moveTo(ex + s, ey - s); g.lineTo(ex - s, ey + s); g.stroke();
		} else {
			const big = opts.scared ? 1.5 : 1;
			g.fillStyle = opts.scared ? "#fff" : COL.trait;
			g.beginPath(); g.ellipse(ex, ey, r * 0.09 * big, r * 0.13 * big, 0, 0, Math.PI * 2); g.fill();
			if (opts.scared) {
				g.lineWidth = lw * 0.5; g.stroke();
				g.fillStyle = COL.trait; g.beginPath(); g.arc(ex + r * 0.04, ey, r * 0.045, 0, Math.PI * 2); g.fill();
				// sourcil inquiet
				g.lineWidth = lw * 0.7;
				g.beginPath(); g.moveTo(ex - r * 0.18, ey - r * 0.2); g.quadraticCurveTo(ex, ey - r * 0.34, ex + r * 0.2, ey - r * 0.3); g.stroke();
			} else {
				g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + r * 0.03, ey - r * 0.05, r * 0.035, 0, Math.PI * 2); g.fill();
			}
		}
		g.restore();
	}

	function canvas(w, h, bg) {
		const c = document.createElement("canvas");
		c.width = w; c.height = h;
		const g = c.getContext("2d");
		if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
		return [c, g];
	}

	// illustration du game over : Pac-Man terrifié, avalé par le démon
	function gameOverBlob(w, h) {
		const [c, g] = canvas(w, h);
		const r = h * 0.36;
		paintPacman(g, w * 0.26, h * 0.74, r, { mouth: 0.7, rot: -0.65, scared: true, lw: 16 });
		// gouttes de sueur
		g.fillStyle = "#cfe9ff"; g.strokeStyle = COL.trait; g.lineWidth = 8;
		for (const [x, y, s] of [[0.42, 0.33, 1], [0.47, 0.42, 0.7]]) {
			const px = w * x, py = h * y, k = 34 * s;
			g.beginPath(); g.moveTo(px, py - k); g.quadraticCurveTo(px + k * 0.9, py + k * 0.4, px, py + k * 0.6); g.quadraticCurveTo(px - k * 0.9, py + k * 0.4, px, py - k); g.fill(); g.stroke();
		}
		return IMG.toBlob(c);
	}

	// schéma du pouvoir dans le miroir (grille 4x4) : Pac-Man fait le tour en mangeant les pac-gommes
	const SCHEMA_PATH = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1]];
	function schemaBlob(w, h, step) {
		const [c, g] = canvas(w, h);
		const cw = w / 4, ch = h / 4;
		const cell = (cx, cy) => [cx * cw + 2, cy * ch + 2, cw - 4, ch - 4];
		const eaten = new Set(SCHEMA_PATH.slice(0, step).map(p => p.join()));
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const [px, py, pw, ph] = cell(x, y);
			g.fillStyle = "#2b2325"; g.fillRect(px, py, pw, ph);
			g.strokeStyle = "#6e5552"; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
			const center = x > 0 && x < 3 && y > 0 && y < 3;
			if (center) {   // super pac-gommes qui clignotent
				if (step % 2 === 0) { g.fillStyle = "#efcb85"; g.beginPath(); g.arc(px + pw / 2, py + ph / 2, pw * 0.22, 0, Math.PI * 2); g.fill(); }
			} else if (!eaten.has(x + "," + y)) {
				g.fillStyle = "#efcb85"; g.beginPath(); g.arc(px + pw / 2, py + ph / 2, pw * 0.08, 0, Math.PI * 2); g.fill();
			}
		}
		const [x, y] = SCHEMA_PATH[step];
		const [nx, ny] = SCHEMA_PATH[(step + 1) % SCHEMA_PATH.length];
		const [px, py, pw, ph] = cell(x, y);
		paintPacman(g, px + pw / 2, py + ph / 2, pw * 0.4, { mouth: step % 2 ? 0.15 : 0.7, rot: Math.atan2(ny - y, nx - x), lw: 2.5 });
		return IMG.toBlob(c);
	}

	const isPacman = rt => rt.globalVars.heros_nom === HERO.nom;

	// ------------------------------------------------------------------
	// 3. Images dessinées (dossier mods/pacman, générées par sources/build_images.py)
	// ------------------------------------------------------------------
	const DIR = "mods/pacman/";
	let manifest = null;
	const getManifest = async () => manifest || (manifest = await (await fetch(DIR + "manifest.json")).json());
	const img = file => IMG.loadBlob(DIR + file);

	// Le visuel en jeu utilise l'objet heros_paysan (famille heros_visuels) : le jeu le synchronise lui-même
	// avec "heros" (position, animation, visibilité, effets). On y met les frames de Pac-Man, avec l'origine
	// de la frame correspondante du chevalier (heros), puis on restaure le paysan après la partie.
	const VISU_OBJ = "heros_paysan";
	const BRAS_ANIM = "magicien";

	// son joué à la mort de Pac-Man, au volume des effets sonores du jeu
	const deathSound = new Audio(DIR + "deathsound.mp3");
	function playDeathSound(rt) {
		const db = Number(rt.globalVars.volumeSonsDB);
		deathSound.volume = db <= -100 ? 0 : Math.min(1, Math.pow(10, db / 20));
		deathSound.currentTime = 0;
		M.log("Son de mort (volume " + deathSound.volume.toFixed(2) + ")");
		deathSound.play().catch(e => M.log("ERREUR son :", e && e.message));
	}

	async function applySwaps() {
		const m = await getManifest();
		const jobs = await Promise.all(m.heros.map(async f => ({
			obj: VISU_OBJ, anim: f.anim, frame: f.frame, blob: await img(f.file),
			// repos : toutes les frames ont la même image, donc la même origine (pas de saccade)
			origin: IMG.frameOrigin("heros", f.anim, f.anim === "idle" ? 0 : f.frame)
		})));
		// main gantée : remplace les poses génériques de heros_main (sans version "_pacman", le jeu garde celles-ci)
		for (const f of m.main || [])
			jobs.push({ obj: "heros_main", anim: f.anim, frame: f.frame, blob: await img(f.file) });
		const [gw, gh] = IMG.frameSize("mort_portraits", "chevalier");
		jobs.push(
			{ obj: "uiFond_portrait", anim: "Default", frame: 0, blob: await img(m.portrait) },
			{ obj: "heros_mort", anim: "chevalier", frame: 0, blob: await img(m.mort) },
			{ obj: "heros_boyaux", anim: "chevalier", frame: 0, blob: await img("heros/bounce_0.png") },
			{ obj: "heros_trail", anim: "chevalier", frame: 0, blob: await img("heros/bounce_0.png") },
			{ obj: "mort_portraits", anim: "chevalier", frame: 0, blob: await gameOverBlob(gw, gh) },
			// bras de la boutique : sans animation "pacman", le jeu garde celle du magicien, qu'on remplace
			{ obj: "heros_bras", anim: BRAS_ANIM, frame: 0, blob: await img(m.bras), origin: IMG.frameOrigin("heros_bras", "chevalier") }
		);
		await IMG.swapFrames(jobs);
		M.log("Images Pac-Man appliquées");
	}

	// Le remplacement des ~60 textures prend quelques secondes : on le lance dès que Pac-Man est choisi dans le hub
	// (et on restaure dès qu'un autre héros est choisi). Les opérations sont mises en file pour ne jamais se chevaucher.
	let imgQueue = Promise.resolve(), wantPacman = null;
	function syncImages(pacman, force = false) {
		if (wantPacman !== pacman || force) {
			wantPacman = pacman;
			imgQueue = imgQueue.then(() => pacman ? applySwaps() : IMG.restore()).catch(e => M.log("ERREUR images :", e && e.stack));
		}
		return imgQueue;
	}

	// miroir : "guerriere_old" est une animation abandonnée, on la remplace une fois pour toutes (en jeu)
	const SCHEMA_ANIM = "guerriere_old";
	let schemaReady = false;
	async function ensureSchema() {
		const inst = M.runtime.objects.miroir_schemaPouvoir.getFirstInstance();
		if (schemaReady || !inst) return;
		const [w, h] = IMG.frameSize("miroir_schemaPouvoir", SCHEMA_ANIM);
		const blobs = await Promise.all(SCHEMA_PATH.map((_, i) => schemaBlob(w, h, i)));
		const anim = inst.animation.name;
		await IMG.replaceFrames(inst, SCHEMA_ANIM, blobs);
		inst.setAnimation(anim);
		schemaReady = true;
	}

	// ------------------------------------------------------------------
	// 4. Hub (titreJeuNew) : perso cliquable
	// ------------------------------------------------------------------
	let hubInst = null;

	async function setupHub(rt) {
		const type = rt.objects.meta_perso;
		const ref = type.getAllInstances()[0];
		if (!ref) return;
		const m = await getManifest();
		const inst = type.createInstance(ref.layer.name, HERO.hubPos[0], HERO.hubPos[1]);
		await IMG.replaceFrames(inst, "Animation 8", await Promise.all(m.hub.map(img)));
		inst.setAnimation("Animation 8");   // sinon l'instance garde l'animation par défaut de meta_perso (le lézard)
		const [w, h] = IMG.frameSize("meta_perso", "Animation 8");
		inst.width = w * HERO.hubScale; inst.height = h * HERO.hubScale;
		Object.assign(inst.instVars, {
			selectionnay: false, numero: HERO.numero, unlock: true,
			nom: HERO.nom, metaProg_caseY: HERO.metaProgCaseY
		});
		hubInst = inst;
		M.log("Pac-Man ajouté au hub, uid", inst.uid);
	}

	function tickHub() {
		const inst = hubInst;
		if (!inst || inst.isDestroyed) return;
		syncImages(isPacman(M.runtime));   // préchargement / restauration selon le héros choisi
		// toujours débloqué, sans le filtre "verrouillé"
		if (!inst.instVars.unlock) inst.instVars.unlock = true;
		for (const fx of inst.effects || []) if (fx.name === "SetColor" && fx.isActive) fx.isActive = false;
		// le jeu utilise 4 images (normal, survol, choisi, choisi+survol) : on n'en a que 2
		if (inst.animationFrame > 1) inst.animationFrame = 1;
	}

	// ------------------------------------------------------------------
	// 5. En jeu : visuel, pouvoir, talent
	// ------------------------------------------------------------------
	let visu = null, heroIV = null, prevPouvoirActif = false, prevMort = false, layoutEnding = false;

	async function setupGame(rt) {
		const h = rt.objects.heros.getFirstInstance();
		if (!h) return;
		const keys = Object.keys(h.instVars);
		heroIV = { charge: keys[13], pouvoir: keys[16] };   // capacite_seuilActuel, capa
		prevMort = !!rt.globalVars.mort;

		await syncImages(true, true);   // complète ce que le préchargement du hub n'aurait pas fini
		// créé après le remplacement : il prend directement la taille des frames de Pac-Man
		const v = rt.objects[VISU_OBJ].createInstance(h.layer.name, h.x, h.y);
		v.setAnimation(h.animation.name);
		[v.width, v.height] = v.getImageSize();   // échelle 1 : le jeu garde ensuite ce rapport à chaque frame
		visu = v;
		M.log("Visuel Pac-Man créé");
		await ensureSchema();
	}

	// avant les événements du jeu
	function tickGame(rt) {
		const h = rt.objects.heros.getFirstInstance();
		if (!h || !visu || visu.isDestroyed) return;

		// pouvoir instantané (comme le pouvoir "soin" prévu par le jeu) : effet dès l'activation
		const actif = !!rt.globalVars.pouvoirActif;
		if (!prevPouvoirActif && actif && h.instVars[heroIV.pouvoir] === HERO.pouvoir) {
			superPacGomme(rt);
			rt.callFunction("capacite_reset", false);   // consomme la charge et éteint le pouvoir
		}
		prevPouvoirActif = !!rt.globalVars.pouvoirActif;

		// mort : le jeu passe la variable "mort" à vrai au début de la chute
		const mort = !!rt.globalVars.mort;
		if (mort && !prevMort) playDeathSound(rt);
		prevMort = mort;
	}

	// après les événements du jeu (tick2) : on corrige ce que le jeu vient de régler pour un héros inconnu
	function tick2Game(rt) {
		if (!visu || visu.isDestroyed) return;
		breathe(rt);
		// portrait de l'interface : image 0 (remplacée par Pac-Man)
		const portrait = rt.objects.uiFond_portrait.getFirstInstance();
		if (portrait && portrait.animationFrame !== 0) portrait.animationFrame = 0;
		// miroir : schéma du pouvoir de Pac-Man
		const schema = rt.objects.miroir_schemaPouvoir.getFirstInstance();
		if (schemaReady && schema && schema.isVisible && schema.animation.name !== SCHEMA_ANIM) schema.setAnimation(SCHEMA_ANIM);
		// bras de la boutique : animation remplacée par le bras de Pac-Man
		for (const bras of rt.objects.heros_bras.getAllInstances()) {
			if (bras.animation.name !== BRAS_ANIM) bras.setAnimation(BRAS_ANIM);
			const [w, h] = bras.getImageSize();   // l'instance garde sinon la taille du bras d'origine (étiré)
			if (bras.width !== w || bras.height !== h) { bras.width = w; bras.height = h; }
		}
	}

	// respiration au repos : la hauteur monte et redescend très légèrement, en continu, pieds au sol.
	// Le jeu vient de replacer le visuel sur "heros" (tick2 = après ses événements) : on ajuste par-dessus.
	const RESPIRATION = { amplitude: 0.015, periode: 2.6 };   // ±1,5 % de hauteur, cycle en secondes
	function breathe(rt) {
		const [w, h] = visu.getImageSize();
		if (visu.animation.name !== "idle") {
			if (visu.width !== w || visu.height !== h) { visu.width = w; visu.height = h; }
			return;
		}
		const k = 1 + RESPIRATION.amplitude * Math.sin(rt.gameTime * 2 * Math.PI / RESPIRATION.periode);
		const originY = IMG.frameOrigin(VISU_OBJ, "idle", 0)[1];
		visu.width = w;
		visu.height = h * k;
		visu.y += (h * k - h) * -(1 - originY);   // garde le bas de l'image (les pieds) à la même place
	}

	function superPacGomme(rt) {
		M.log("Super Pac-Gomme !");
		try { rt.callFunction("malediction_debuff_monstresTous", CONFIG.debuffPouvoir); }
		catch (e) { M.log("ERREUR debuff :", e && e.stack); }
		popText("WAKA WAKA !");
	}

	function onMonsterDestroyed(rt, inst) {
		if (layoutEnding || !isPacman(rt) || !visu) return;
		const h = rt.objects.heros.getFirstInstance();
		if (!h) return;
		if (inst.instVars.type !== "monstre") return;
		if (Math.hypot(inst.x - h.x, inst.y - h.y) > 160) return;   // seulement le monstre combattu
		if (Math.random() < CONFIG.chanceSoinTalent) {
			M.log("Talent Glouton : +1 PV");
			try { rt.callFunction("malediction_effet_heal", 1); popText("MIAM !"); }
			catch (e) { M.log("ERREUR soin :", e && e.stack); }
		}
	}

	// petit texte animé par-dessus le jeu
	function popText(txt) {
		const el = document.createElement("div");
		el.textContent = txt;
		el.style.cssText = "position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:99998;" +
			"font:900 72px 'Avara-Black',sans-serif;color:" + COL.jaune + ";-webkit-text-stroke:4px " + COL.trait + ";" +
			"pointer-events:none;transition:transform .5s cubic-bezier(.2,1.6,.4,1),opacity .6s 1.2s;opacity:1";
		document.body.appendChild(el);
		requestAnimationFrame(() => { el.style.transform = "translate(-50%,-60%) scale(1)"; el.style.opacity = "0"; });
		setTimeout(() => el.remove(), 2000);
	}

	// ------------------------------------------------------------------
	// 6. Branchement sur le runtime
	// ------------------------------------------------------------------
	M.pacman = { setupHub, setupGame, superPacGomme, get hubInst() { return hubInst; }, get visu() { return visu; } };

	M.onStartup(rt => {
		rt.addEventListener("afteranylayoutstart", () => {
			layoutEnding = false;
			hubInst = null; visu = null; prevPouvoirActif = false; prevMort = false;
			const hasHero = !!rt.objects.heros.getFirstInstance();
			if (rt.layout.name === "titreJeuNew") setupHub(rt).catch(e => M.log("ERREUR hub :", e && e.stack));
			else if (hasHero && isPacman(rt)) setupGame(rt).catch(e => M.log("ERREUR jeu :", e && e.stack));
			else if (hasHero) syncImages(false);
		});
		rt.addEventListener("beforeanylayoutend", () => { layoutEnding = true; });
		rt.objects.pions.addEventListener("instancedestroy", e => onMonsterDestroyed(rt, e.instance));
		rt.addEventListener("tick", () => {
			try {
				if (hubInst) tickHub();
				if (visu) tickGame(rt);
			} catch (e) { M.log("ERREUR tick :", e && e.stack); }
		});
		rt.addEventListener("tick2", () => {
			try {
				if (hubInst) tickHub();
				if (visu) tick2Game(rt);
			} catch (e) { M.log("ERREUR tick2 :", e && e.stack); }
		});
	});
})();
