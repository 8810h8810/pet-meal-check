# Private test: chart localization v3

Built-in image generation edit mode was used for four assets in assets: dog-es-v3.png, dog-nl-v3.png, cat-es-v3.png, cat-nl-v3.png. Original Japanese and English assets remain byte-identical. Full generated image outputs are candidates for private review; generative edits may differ in fine strokes and are not proof of pixel-identical artwork preservation.

Prompt specification: replace only English lettering with Spanish or Dutch lettering; preserve animal, bowls, food, fish/bones, sun/moon, fourteen paws, grid boundaries, pastel colors, composition; remove original text without patches; no redesign. Spanish exact text: ¡BUEN INTENTO! / ¡YA HAS COMIDO!; DÍA, MAÑANA, NOCHE; LUN, MAR, MIÉ, JUE, VIE, SÁB, DOM; REINICIAR. Dutch exact text: LEUK GEPROBEERD! / JE HEBT AL GEGETEN!; DAG, OCHTEND, AVOND; MA, DI, WO, DO, VR, ZA, ZO; WISSEN.

All four outputs visually inspected for text, fourteen paws, seven rows, and clean background. Full assets replace the defective overlay/paper-patch implementation. Tap geometry follows original JA/EN layouts. Record keys and route remain unchanged through language changes. Production GitHub Pages is unchanged. These accepted private-test assets are now staged in the draft release branch; Firebase/Analytics isolation from the private copy is not included.

Run node tests/i18n.test.cjs. Tests use DOM doubles, not a browser. Browser/device QA and live shared synchronization remain unverified. No paid external service or contract was added.
