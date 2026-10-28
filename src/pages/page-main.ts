import {withController} from '@snar/lit'
import {css, html} from 'lit'
import {withStyles} from 'lit-with-styles'
import {customElement, state} from 'lit/decorators.js'
import {stateless} from '../stateless.js'
import {store} from '../store.js'
import {PageElement} from './PageElement.js'

type MouseButton = 'left' | 'right'

interface ButtonStats {
	totalClicks: number
	anomalies: Record<number, number>
}

interface ClickStats {
	buttons: Record<MouseButton, ButtonStats>
	missedBeats: number
	earlyClicks: number
	lateClicks: number
	reactionTotal: number
	reactionSamples: number
}

const BEAT_MS = 700
const FLASH_MS = 50
const TOLERANCE_MS = 200
const MISSED_BEATS_THRESHOLD = 3

function createButtonStats(): ButtonStats {
	return {
		totalClicks: 0,
		anomalies: {},
	}
}

function createStats(): ClickStats {
	return {
		buttons: {
			left: createButtonStats(),
			right: createButtonStats(),
		},
		missedBeats: 0,
		earlyClicks: 0,
		lateClicks: 0,
		reactionTotal: 0,
		reactionSamples: 0,
	}
}

function percentage(value: number, total: number): string {
	return total === 0 ? '—' : `${((value / total) * 100).toFixed(2)}%`
}

declare global {
	interface HTMLElementTagNameMap {
		'page-main': PageMain
	}
}

@customElement('page-main')
@withController(store)
@withController(stateless)
@withStyles(css`
	:host {
		position: absolute;
		inset: 0;
		background-color: var(--md-sys-color-surface-container-lowest);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
	}

	:host(.flash) {
		background-color: var(--md-sys-color-surface-container-highest);
	}

	.stats {
		position: fixed;
		bottom: 16px;
		left: 16px;
		padding: 12px 16px;
		background-color: var(--md-sys-color-surface-container);
		color: var(--md-sys-color-on-surface);
		border-radius: 8px;
		font-family: monospace;
		font-size: 12px;
		line-height: 1.6;
		pointer-events: none;
	}

	.stats h3 {
		margin: 0 0 4px;
		font-size: 13px;
	}

	.stats section + section {
		margin-top: 8px;
	}

	.stats .muted {
		opacity: 0.65;
	}

	.stats .anomalies {
		padding-left: 12px;
	}
`)
export class PageMain extends PageElement {
	@state()
	private stats: ClickStats = createStats()

	private beatStart = 0
	private beatIndex = 0
	private beatTimer?: ReturnType<typeof setInterval>
	private flashTimer?: ReturnType<typeof setTimeout>

	private pendingMisses = 0

	// Nombre de clics par bouton et par battement.
	private beatClicks = new Map<number, Record<MouseButton, number>>()

	// Évite de compter deux fois une même anomalie.
	private finalizedBeats = new Set<number>()

	private onPointerUp = (event: PointerEvent) => {
		if (event.button !== 0 && event.button !== 2) return

		const button: MouseButton = event.button === 0 ? 'left' : 'right'
		const now = performance.now()
		const beat = Math.round((now - this.beatStart) / BEAT_MS)
		const beatTime = this.beatStart + beat * BEAT_MS
		const offset = now - beatTime

		const buttons = this.stats.buttons
		buttons[button].totalClicks++

		this.stats.reactionTotal += offset
		this.stats.reactionSamples++

		if (offset < -TOLERANCE_MS) {
			this.stats.earlyClicks++
		} else if (offset > TOLERANCE_MS) {
			this.stats.lateClicks++
		}

		let clicks = this.beatClicks.get(beat)

		if (!clicks) {
			clicks = {left: 0, right: 0}
			this.beatClicks.set(beat, clicks)
		}

		clicks[button]++

		// Un clic qui reprend après une courte absence confirme
		// les battements manqués provisoires.
		if (this.pendingMisses > 0) {
			this.stats.missedBeats += this.pendingMisses
			this.pendingMisses = 0
		}

		this.stats = {...this.stats, buttons: {...buttons}}
	}

	private onContextMenu = (event: MouseEvent) => {
		event.preventDefault()
	}

	private onKeyDown = (event: KeyboardEvent) => {
		if (
			(event.key.toLowerCase() !== 'r' && event.key.toLowerCase() !== 'c') ||
			event.repeat ||
			event.ctrlKey ||
			event.altKey ||
			event.metaKey
		) {
			return
		}
		if (event.key.toLowerCase() === 'c') {
			void this.copyStats()
			return
		}

		const target = event.target
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
		) {
			return
		}

		this.resetStats()
	}

	constructor() {
		super()
	}

	connectedCallback() {
		super.connectedCallback()

		this.addEventListener('pointerup', this.onPointerUp)
		this.addEventListener('contextmenu', this.onContextMenu)
		window.addEventListener('keydown', this.onKeyDown)

		this.beatStart = performance.now()
		this.beatIndex = 0
		this.flash()

		this.beatTimer = setInterval(() => {
			this.finishBeat(this.beatIndex)
			this.beatIndex++
			this.flash()
		}, BEAT_MS)
	}

	disconnectedCallback() {
		super.disconnectedCallback()

		this.removeEventListener('pointerup', this.onPointerUp)
		this.removeEventListener('contextmenu', this.onContextMenu)
		window.removeEventListener('keydown', this.onKeyDown)

		if (this.beatTimer) clearInterval(this.beatTimer)
		if (this.flashTimer) clearTimeout(this.flashTimer)
	}

	private flash() {
		this.classList.add('flash')

		if (this.flashTimer) clearTimeout(this.flashTimer)

		this.flashTimer = setTimeout(() => {
			this.classList.remove('flash')
		}, FLASH_MS)
	}

	private finishBeat(beat: number) {
		if (this.finalizedBeats.has(beat)) return
		this.finalizedBeats.add(beat)

		const clicks = this.beatClicks.get(beat)

		if (!clicks || clicks.left + clicks.right === 0) {
			this.pendingMisses++

			if (this.pendingMisses >= MISSED_BEATS_THRESHOLD) {
				// Une pause probable : on abandonne les manqués provisoires.
				this.pendingMisses = 0
			}
		}

		if (clicks) {
			for (const button of ['left', 'right'] as const) {
				const count = clicks[button]

				if (count > 1) {
					const anomalies = this.stats.buttons[button].anomalies
					anomalies[count] = (anomalies[count] ?? 0) + 1
				}
			}
		}

		this.beatClicks.delete(beat)

		// Évite que les index terminés s'accumulent indéfiniment.
		if (this.finalizedBeats.size > 100) {
			const oldest = Math.min(...this.finalizedBeats)
			this.finalizedBeats.delete(oldest)
		}

		this.stats = {
			...this.stats,
			buttons: {
				left: {
					...this.stats.buttons.left,
					anomalies: {...this.stats.buttons.left.anomalies},
				},
				right: {
					...this.stats.buttons.right,
					anomalies: {...this.stats.buttons.right.anomalies},
				},
			},
		}
	}

	private resetStats() {
		this.stats = createStats()
		this.pendingMisses = 0
		this.beatClicks.clear()
		this.finalizedBeats.clear()
	}

	private renderButtonStats(button: MouseButton, label: string) {
		const stats = this.stats.buttons[button]
		const anomalyGroups = Object.entries(stats.anomalies).sort(
			([a], [b]) => Number(a) - Number(b),
		)

		const extraClicks = anomalyGroups.reduce(
			(total, [count, occurrences]) =>
				total + (Number(count) - 1) * occurrences,
			0,
		)

		const affectedActions = anomalyGroups.reduce(
			(total, [, occurrences]) => total + occurrences,
			0,
		)

		return html`
			<section>
				<h3>${label}</h3>
				<div>Clics reçus : ${stats.totalClicks}</div>
				<div>
					Clics parasites estimés : ${extraClicks}
					(${percentage(extraClicks, stats.totalClicks)})
				</div>
				<div>
					Actions affectées : ${affectedActions}
					(${percentage(affectedActions, stats.totalClicks)})
				</div>

				${
					anomalyGroups.length
						? html`
								<div class="anomalies">
									${anomalyGroups.map(
										([count, occurrences]) => html`
											<div>${count} clics : ${occurrences} occurrence(s)</div>
										`,
									)}
								</div>
							`
						: html`<div class="muted">Aucune anomalie détectée</div>`
				}
			</section>
		`
	}

	render() {
		const totalClicks =
			this.stats.buttons.left.totalClicks + this.stats.buttons.right.totalClicks

		const averageReaction =
			this.stats.reactionSamples > 0
				? Math.round(this.stats.reactionTotal / this.stats.reactionSamples)
				: undefined

		return html`
			<div>Click to match</div>

			<div class="stats">
				<h3>Mouse test</h3>
				<div>Total des clics : ${totalClicks}</div>
				<div>Battements manqués confirmés : ${this.stats.missedBeats}</div>
				<div>
					Clics précoces : ${this.stats.earlyClicks}
					(${percentage(this.stats.earlyClicks, totalClicks)})
				</div>
				<div>
					Clics tardifs : ${this.stats.lateClicks}
					(${percentage(this.stats.lateClicks, totalClicks)})
				</div>
				<div>
					Écart moyen :
					${averageReaction === undefined ? '—' : `${averageReaction} ms`}
				</div>

				${this.renderButtonStats('left', 'Clic gauche')}
				${this.renderButtonStats('right', 'Clic droit')}

				<div class="muted">Appuie sur R pour réinitialiser</div>
			</div>
		`
	}

	private async copyStats() {
		const stats = this.stats

		const lines = [
			`Total des clics : ${stats.buttons.left.totalClicks + stats.buttons.right.totalClicks}`,
			`Battements manqués : ${stats.missedBeats}`,
			`Clics précoces : ${stats.earlyClicks}`,
			`Clics tardifs : ${stats.lateClicks}`,
			`Écart moyen : ${
				stats.reactionSamples
					? `${Math.round(stats.reactionTotal / stats.reactionSamples)} ms`
					: '—'
			}`,
		]

		for (const [button, label] of [
			['left', 'Clic gauche'],
			['right', 'Clic droit'],
		] as const) {
			const buttonStats = stats.buttons[button]
			const extraClicks = Object.entries(buttonStats.anomalies).reduce(
				(total, [count, occurrences]) =>
					total + (Number(count) - 1) * occurrences,
				0,
			)

			lines.push(
				'',
				`${label} :`,
				`  Clics reçus : ${buttonStats.totalClicks}`,
				`  Clics parasites estimés : ${extraClicks}`,
				`  Anomalies : ${JSON.stringify(buttonStats.anomalies)}`,
			)
		}

		await navigator.clipboard.writeText(lines.join('\n'))
	}
}

// export const pageMain = new PageMain()
