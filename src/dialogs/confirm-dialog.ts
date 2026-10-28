import { html, TemplateResult } from 'lit'
import { Dialog } from './dialogs.js'

/**
 * @example
 * const confirm = await spawnConfirmDialog()
 * const ok = await confirm({ content: 'This will delete the element', error: true })
 * if (ok) {
 *   // Proceed
 * }
 */
export function confirmDialog({
	content,
	headline = 'Are you sure?',
	confirmLabel = 'Accept',
	error = false,
}: {
	content: string | TemplateResult
	headline?: string
	confirmLabel?: string
	error?: boolean
}) {
	return new Promise<boolean>((resolve) => {
		new Dialog(
			headline,
			html`<!---->
				${content}
				<!---->`,
			{
				closeButton: undefined,

				actions() {
					return html`<!---->
						<md-text-button @click="${() => resolve(false)}" close>
							Cancel
						</md-text-button>
						<md-filled-tonal-button
							?error="${error}"
							@click="${() => resolve(true)}"
							close
						>
							${confirmLabel}
						</md-filled-tonal-button>
						<!---->`
				},
			},
		)
	})
}
