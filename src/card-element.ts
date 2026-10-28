import '@material/web/labs/card/elevated-card.js'
import {html, LitElement} from 'lit'
import {withStyles} from 'lit-with-styles'
import {property} from 'lit/decorators.js'

@withStyles()
class CardElement extends LitElement {
	@property() headline = ''

	render() {
		const headline = this.headline
		// .replace(/=/g, '')
		// .trim()
		// .toLowerCase()
		// .replace(/^./, (c) => c.toUpperCase())

		return html`<!-- -->
			<md-elevated-card class="text-(--md-sys-color-on-surface)">
				<div
					id="content"
					class="flex flex-col flex-1 justify-between gap-4 p-4"
				>
					${headline ? html`<div>${headline}</div>` : null}
					<slot></slot>
				</div>
			</md-elevated-card>
			<!-- -->`
	}
}

window.customElements.define('card-element', CardElement)
