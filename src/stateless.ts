import {PropertyValues, ReactiveController as Snar, state} from '@snar/lit'

class StatelessController extends Snar {
	@state() loading = false
	@state() audioPlaying = false
	@state() autorunWasBlocked = false
	@state() feedback = ''

	updated(changed: PropertyValues<this>) {
		// if (changed.has('loading'))  {
		// 	// do something
		// }
	}
}

export const stateless = new StatelessController()

// @ts-ignore
window.stateless = stateless
