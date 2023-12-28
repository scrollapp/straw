
namespace Straw
{
	/**
	 * @internal
	 */
	export class ImageRewriter
	{
		/** */
		constructor(
			private readonly imageSearchRoot: Fila,
			private readonly imageSaveRoot: Fila)
		{ }
		
		/**
		 * Scans the specified top-level HTML elements, and their nested elements,
		 * for elements that have attributes and styles that reference external image files.
		 * These images are extracted and copied to the output location, and the
		 * attribute and style values are replaced with new values that reference the
		 * image in the output location.
		 * 
		 * The function also deals with image processing. Non-SVG Image URLs can
		 * have parameters such as width= and height=, which are processed by Photon.
		 */
		async adjust(...containers: HTMLElement[])
		{
			for (const x of scanForImages(containers))
			{
				if (x instanceof DiscoveredProperty)
				{
					const parsedDatas = parseImageUrl(x.value);
					let propertyValue = x.value;
					
					for (let i = parsedDatas.length; i-- > 0;)
					{
						const params = parsedDatas[i];
						const imageFila = await ImageProcessor.findImage(this.imageSearchRoot, params.name);
						if (!imageFila)
							throw new Error("No image found with name: " + params.name);
						
						const processedFilePath = await ImageProcessor.processImage(
							imageFila,
							this.imageSaveRoot,
							params);
						
						propertyValue = 
							propertyValue.slice(0, params.start) +
							processedFilePath +
							propertyValue.slice(params.end);
					}
					
					x.style.setProperty(x.property, propertyValue);
				}
				else if (x instanceof Attr)
				{
					const params = parseImageUrl(x.value)[0];
					const imageFila = await ImageProcessor.findImage(this.imageSearchRoot, params.name);
					if (!imageFila)
						throw new Error("No image found with name: " + params.name);
					
					x.value = await ImageProcessor.processImage(imageFila, this.imageSaveRoot, params);
				}
			}
		}
	}
	
	/**
	 * Scans for HTML attributes and CSS properties that have URLs
	 * in them that refer to external resource files.
	 */
	function scanForImages(within: HTMLElement | HTMLElement[])
	{
		const containers = Array.isArray(within) ? within : [within];
		const result: (Attr | DiscoveredProperty)[] = [];
		
		for (const container of containers)
		{
			for (const e of Util.walkElementTree(container))
			{
				const tag = e.tagName;
				const attributes = [
					e.getAttributeNode("src"),
					tag === "EMBED" && e.getAttributeNode("source"),
					tag === "VIDEO" && e.getAttributeNode("poster"),
					tag === "OBJECT" && e.getAttributeNode("data"),
					tag === "FORM" && e.getAttributeNode("action"),
					tag === "LINK" && 
						(e.getAttribute("rel") ===  "icon" || e.getAttribute("rel") === "shortcut icon") && 
						e.getAttributeNode("href"),
				];
				
				if (tag === "STYLE")
				{
					const sheet = (e as HTMLStyleElement).sheet;
					if (sheet)
					{
						for (let i = -1; ++i < sheet.cssRules.length;)
						{
							const rule = sheet.cssRules[i] as CSSStyleRule;
							result.push(...discoverProperties(rule.style));
						}
					}
				}
				else
				{
					for (const attr of attributes)
						if (attr && attr.value)
							if (!reg.test(attr.value))
								result.push(attr);
					
					result.push(...discoverProperties(e.style));
				}
			}
		}
		
		return result;
	}
	
	/** */
	function discoverProperties(style: CSSStyleDeclaration)
	{
		const discovered: DiscoveredProperty[] = [];
		
		for (const property of Straw.cssPropertiesWithUrls)
		{
			const val = style.getPropertyValue(property);
			if (val && !reg.test(val) && val.includes("url("))
				discovered.push(new DiscoveredProperty(style, property, val));
		}
		
		return discovered;
	}
	const reg = /^https?:\/\//;
	
	/** */
	class DiscoveredProperty
	{
		constructor(
			readonly style: CSSStyleDeclaration,
			readonly property: string,
			readonly value: string
		) { }
	}
	
	/**
	 * Parses image urls, in the format image.png?width=10,height=10
	 * The image URL may be encapsulated with in a CSS url() definition,
	 * such as url (image.png?width=10,height=10).
	 * The supplied string may also contain multiple instances of these
	 * image definitions.
	 */
	function parseImageUrl(value: string): ImageParams[]
	{
		const files: ImageParams[] = [];
		const urls: { url: string; start: number, end: number }[] = [];
		const reg = /url\("?([/A-Za-z0-9\.\-\_]+(\?[a-z=\,\d+]+)?)"?\)/g;
		
		if (value.includes("url("))
		{
			let lastEnd = 0;
			const matches = value.matchAll(reg);
			
			for (const match of matches)
			{
				const url = match[1];
				const start = value.indexOf(url, lastEnd);
				const end = lastEnd = start + url.length;
				urls.push({ url, start, end });
			}
		}
		else urls.push({ url: value, start: 0, end: value.length });
		
		for (const { url, start, end } of urls)
		{
			let name = "";
			let extension = "";
			let width = 0;
			let height = 0;
			let blur = 0;
			let gray = false;
			
			const parts = url.split(imageParamsSplit);
			name = parts[0];
			
			for (const ext of ImageProcessor.extensions)
				if (name.endsWith(ext))
					extension = ext;
			
			if (parts.length > 1)
			{
				const params = parts[1].split(",").map(s => s.split("=") as [string, string?]);
				for (const [k, v] of params)
				{
					if (k === "width")
						width = Number(v) || 0;
					
					if (k === "height")
						height = Number(v) || 0;
					
					if (k === "blur")
						blur = Number(v) || 0;
					
					if (k === "gray")
						gray = true;
				}
			}
			
			files.push({ name, extension, start, end, width, height, blur, gray });
		}
		
		return files;
	}
	
	const imageParamsSplit = "?";
}
