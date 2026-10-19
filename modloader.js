// Sol Cesto - chargeur de mods
// Charge tous les fichiers .js du dossier "mods" (ordre alphabétique) avant le démarrage du jeu.
// API exposée aux mods : window.SolCestoMods
"use strict";
(function () {
	const startupQueue = [];
	let realRunOnStartup = null;

	const api = window.SolCestoMods = {
		loaded: [],
		errors: [],
		runtime: null,
		// Appelle fn(runtime) au démarrage du runtime Construct 3 (équivalent de runOnStartup)
		onStartup(fn) {
			if (realRunOnStartup) realRunOnStartup(fn);
			else startupQueue.push(fn);
		},
		history: [],
		log(...args) {
			console.log("[Mods]", ...args);
			api.history.push(new Date().toLocaleTimeString() + " " + args.join(" "));
			if (api.history.length > 200) api.history.shift();
		},
		// Modifie un fichier JSON du jeu au chargement : fn(data) modifie data (ou renvoie un nouvel objet)
		patchJson(fileName, fn) {
			if (!jsonPatches.has(fileName)) jsonPatches.set(fileName, []);
			jsonPatches.get(fileName).push(fn);
		},
		// Accès aux tableaux Construct (format c2array) : cellule [x][y][z]
		c2get(arr, x, y, z = 0) { return arr.data[x][y][z]; },
		c2set(arr, x, y, value, z = 0) { arr.data[x][y][z] = value; },
		images: null
	};

	// ------------------------------------------------------------------
	// Outils d'images : remplacer les images d'animations de sprites
	// (un remplacement touche toutes les instances de l'objet)
	// ------------------------------------------------------------------
	const originals = new Map();   // "objet|anim|frame" -> { blob, origin } d'origine
	const swapped = new Set();
	const sheetCache = new Map();  // url de planche -> Image décodée
	const internal = () => c3_runtimeInterface._localRuntime;
	const frameInfo = (objName, animName, frameIndex) =>
		internal().GetObjectClassByName(objName).GetAnimationByName(animName).GetFrameAt(frameIndex);
	const keyOf = (o, a, f) => o + "|" + a + "|" + f;
	const isDynamic = (o, a, f) => frameInfo(o, a, f).GetImageInfo().GetURL() === "";

	async function loadSheet(url) {
		if (!sheetCache.has(url)) sheetCache.set(url, (async () => { const img = new Image(); img.src = url; await img.decode(); return img; })());
		return sheetCache.get(url);
	}

	// Remplace l'image d'une frame directement dans l'objet (comme replaceCurrentAnimationFrame du moteur,
	// mais sans instance : rien ne peut être annulé par un changement de layout pendant le chargement).
	async function replaceImage(objName, animName, frameIndex, blob, origin) {
		const lr = internal();
		const frame = frameInfo(objName, animName, frameIndex);
		const img = C3.New(C3.ImageInfo);
		img.LoadDynamicBlobAsset(lr, blob);
		await img.LoadStaticTexture(lr.GetRenderer(), { sampling: lr.GetSampling() });
		// On laisse la frame dans l'état où le moteur l'attend : si sa texture d'origine n'était pas chargée
		// (objet absent du layout en cours), on libère la nôtre ; le moteur la rechargera depuis le blob
		// quand il chargera l'objet. Sinon, son chargement du layout suivant planterait ("already loaded texture").
		const target = frame.GetImageInfo();
		const keepLoaded = !!target._textureState;
		target.ReplaceWith(img);
		if (!keepLoaded) target.ReleaseTexture();
		if (origin) frame._origin.set(origin[0], origin[1]);
		const sdkType = lr.GetObjectClassByName(objName).GetSdkType();
		if (sdkType && sdkType._UpdateAllCurrentTexture) sdkType._UpdateAllCurrentTexture();
		lr.UpdateRender();
	}

	api.images = {
		// canvas -> Blob PNG, sans bloquer le jeu (canvas.toBlob est asynchrone ; il met ~1 s mais en arrière-plan)
		toBlob: canvas => new Promise(res => canvas.toBlob(res, "image/png")),

		// remplace les images 0..n-1 d'une animation de l'objet de cette instance
		async replaceFrames(inst, animName, blobs) {
			const obj = inst.objectType.name;
			await Promise.all(blobs.map((b, i) => replaceImage(obj, animName, i, b)));
		},

		replaceImage,

		// découpe l'image d'origine d'une frame dans sa planche de sprites
		async originalBlob(objName, animName, frameIndex) {
			const info = frameInfo(objName, animName, frameIndex).GetImageInfo();
			if (!info.GetURL()) return null;
			const img = await loadSheet(info.GetURL());
			const c = document.createElement("canvas");
			c.width = info.GetWidth(); c.height = info.GetHeight();
			c.getContext("2d").drawImage(img, info.GetOffsetX(), info.GetOffsetY(), c.width, c.height, 0, 0, c.width, c.height);
			return api.images.toBlob(c);
		},

		frameSize(objName, animName, frameIndex = 0) {
			const info = frameInfo(objName, animName, frameIndex).GetImageInfo();
			return [info.GetWidth(), info.GetHeight()];
		},

		frameOrigin(objName, animName, frameIndex = 0) {
			const f = frameInfo(objName, animName, frameIndex);
			return [f.GetOriginX(), f.GetOriginY()];
		},

		// charge une image du dossier du jeu (ex. "mods/pacman/portrait.png") en Blob
		async loadBlob(path) {
			const res = await fetch(path);
			if (!res.ok) throw new Error("image introuvable : " + path);
			return res.blob();
		},

		// remplace des frames en mémorisant les originales (pour restore()).
		// jobs : [{ obj, anim, frame, blob, origin: [x, y] (facultatif, origine normalisée) }]
		// Une frame n'est marquée "échangée" qu'une fois le remplacement réellement effectué.
		async swapFrames(jobs) {
			jobs = jobs.filter(j => !swapped.has(keyOf(j.obj, j.anim, j.frame)));
			await Promise.all(jobs.map(async j => {
				const key = keyOf(j.obj, j.anim, j.frame);
				if (!originals.has(key)) originals.set(key, {
					blob: await api.images.originalBlob(j.obj, j.anim, j.frame),
					origin: api.images.frameOrigin(j.obj, j.anim, j.frame)
				});
				await replaceImage(j.obj, j.anim, j.frame, j.blob, j.origin);
				if (isDynamic(j.obj, j.anim, j.frame)) swapped.add(key);
			}));
		},

		swapFrame(obj, anim, frame, blob, origin) { return api.images.swapFrames([{ obj, anim, frame, blob, origin }]); },

		isSwapped: (objName, animName, frameIndex) => swapped.has(keyOf(objName, animName, frameIndex)),

		// remet les images (et origines) d'origine de toutes les frames échangées
		async restore() {
			const keys = [...swapped];
			swapped.clear();
			await Promise.all(keys.map(key => {
				const [obj, anim, frame] = key.split("|");
				const o = originals.get(key);
				return o && o.blob ? replaceImage(obj, anim, Number(frame), o.blob, o.origin) : null;
			}));
		}
	};

	// Interception des requêtes XHR du plugin AJAX pour appliquer les patchs JSON
	const jsonPatches = new Map();
	const xhrOpen = XMLHttpRequest.prototype.open;
	const responseTextDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "responseText");
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		const file = String(url).split(/[?#]/)[0].split("/").pop();
		const patches = jsonPatches.get(file);
		if (patches) {
			let cache = null;
			Object.defineProperty(this, "responseText", {
				configurable: true,
				get() {
					const raw = responseTextDesc.get.call(this);
					if (this.readyState !== 4 || !raw) return raw;
					if (cache === null) {
						try {
							let data = JSON.parse(raw);
							for (const p of patches) data = p(data) || data;
							cache = JSON.stringify(data);
							api.log("JSON patché :", file);
						} catch (e) {
							console.error("[Mods] Échec du patch de", file, e);
							cache = raw;
						}
					}
					return cache;
				}
			});
		}
		return xhrOpen.call(this, method, url, ...rest);
	};

	// main.js définit self.runOnStartup plus tard : on intercepte l'affectation pour vider la file
	Object.defineProperty(self, "runOnStartup", {
		configurable: true,
		get() { return realRunOnStartup; },
		set(fn) {
			realRunOnStartup = fn;
			fn(runtime => { api.runtime = runtime; });
			for (const f of startupQueue.splice(0)) fn(f);
		}
	});

	let fs, path, modsDir;
	try {
		fs = require("fs");
		path = require("path");
		modsDir = path.join(nw.__dirname || path.dirname(process.mainModule.filename), "mods");
	} catch (e) {
		api.errors.push("Node.js indisponible : " + e);
		console.error("[Mods] Node.js indisponible", e);
		return;
	}
	api.modsDir = modsDir;

	let files = [];
	try {
		files = fs.readdirSync(modsDir).filter(f => f.endsWith(".js")).sort();
	} catch (e) {
		api.errors.push("Dossier mods introuvable : " + modsDir);
		return;
	}

	for (const file of files) {
		// document.write garde l'exécution synchrone et ordonnée, avant main.js (module différé)
		document.write(`<script src="mods/${encodeURI(file)}" onerror="SolCestoMods.errors.push('échec ${file}')"><\/script>`);
		api.loaded.push(file);
	}
	api.log("Mods trouvés :", files);
})();
