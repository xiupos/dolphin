// 画像だけ
<template>
<div
	class="note _panel"
	v-show="appearNote.deletedAt == null && !hideThisNote"
	:tabindex="appearNote.deletedAt == null ? '-1' : null"
	:class="{ renote: isRenote }"
	v-hotkey="keymap"
	v-if="!appearNote.reply && !isRenote && note.visibility == 'public'"
>
	<article class="article">
		<div class="files" v-if="appearNote.files.length > 0">
			<x-media-list :media-list="appearNote.files"/>
		</div>
	</article>
</div>
</template>

<script lang="ts">
import Vue from 'vue';
import { faPlus, faMinus, faRetweet, faReply, faReplyAll, faEllipsisH, faHome, faUnlock, faEnvelope, faThumbtack, faBan } from '@fortawesome/free-solid-svg-icons';
import { parse } from '../../mfm/parse';
import { sum, unique } from '../../prelude/array';
import i18n from '../i18n';
import XSub from './note.sub.vue';
import XNoteHeader from './note-header.vue';
import XNotePreview from './note-preview.vue';
import XReactionsViewer from './reactions-viewer.vue';
import XMediaList from './media-list-i.vue';
import XCwButton from './cw-button.vue';
import XPoll from './poll.vue';
import XUrlPreview from './url-preview.vue';
import DpNoteMenu from './note-menu.vue';
import DpReactionPicker from './reaction-picker.vue';
import DpRenotePicker from './renote-picker.vue';
import pleaseLogin from '../scripts/please-login';

function focus(el, fn) {
	const target = fn(el);
	if (target) {
		if (target.hasAttribute('tabindex')) {
			target.focus();
		} else {
			focus(target, fn);
		}
	}
}

export default Vue.extend({
	i18n,
	
	components: {
		XSub,
		XNoteHeader,
		XNotePreview,
		XReactionsViewer,
		XMediaList,
		XCwButton,
		XPoll,
		XUrlPreview,
	},

	props: {
		note: {
			type: Object,
			required: true
		},
		detail: {
			type: Boolean,
			required: false,
			default: false
		},
		pinned: {
			type: Boolean,
			required: false,
			default: false
		},
	},

	data() {
		return {
			connection: null,
			conversation: [],
			replies: [],
			showContent: false,
			hideThisNote: false,
			openingMenu: false,
			faPlus, faMinus, faRetweet, faReply, faReplyAll, faEllipsisH, faHome, faUnlock, faEnvelope, faThumbtack, faBan
		};
	},

	computed: {
		keymap(): any {
			return {
				'r': () => this.reply(true),
				'e|a|plus': () => this.react(true),
				'q': () => this.renote(true),
				'f|b': this.favorite,
				'delete|ctrl+d': this.del,
				'ctrl+q': this.renoteDirectly,
				'up|k|shift+tab': this.focusBefore,
				'down|j|tab': this.focusAfter,
				'esc': this.blur,
				'm|o': () => this.menu(true),
				's': this.toggleShowContent,
				'1': () => this.reactDirectly(this.$store.state.settings.reactions[0]),
				'2': () => this.reactDirectly(this.$store.state.settings.reactions[1]),
				'3': () => this.reactDirectly(this.$store.state.settings.reactions[2]),
				'4': () => this.reactDirectly(this.$store.state.settings.reactions[3]),
				'5': () => this.reactDirectly(this.$store.state.settings.reactions[4]),
				'6': () => this.reactDirectly(this.$store.state.settings.reactions[5]),
				'7': () => this.reactDirectly(this.$store.state.settings.reactions[6]),
				'8': () => this.reactDirectly(this.$store.state.settings.reactions[7]),
				'9': () => this.reactDirectly(this.$store.state.settings.reactions[8]),
				'0': () => this.reactDirectly(this.$store.state.settings.reactions[9]),
			};
		},

		isRenote(): boolean {
			return (this.note.renote &&
				this.note.text == null &&
				this.note.fileIds.length == 0 &&
				this.note.poll == null);
		},

		appearNote(): any {
			return this.isRenote ? this.note.renote : this.note;
		},

		isMyNote(): boolean {
			return this.$store.getters.isSignedIn && (this.$store.state.i.id === this.appearNote.userId);
		},

		reactionsCount(): number {
			return this.appearNote.reactions
				? sum(Object.values(this.appearNote.reactions))
				: 0;
		},

		title(): string {
			return '';
		},

		urls(): string[] {
			if (this.appearNote.text) {
				const ast = parse(this.appearNote.text);
				// TODO: 再帰的にURL要素がないか調べる
				const urls = unique(ast
					.filter(t => ((t.node.type == 'url' || t.node.type == 'link') && t.node.props.url && !t.node.props.silent))
					.map(t => t.node.props.url));

				// unique without hash
				// [ http://a/#1, http://a/#2, http://b/#3 ] => [ http://a/#1, http://b/#3 ]
				const removeHash = x => x.replace(/#[^#]*$/, '');

				return urls.reduce((array, url) => {
					const removed = removeHash(url);
					if (!array.map(x => removeHash(x)).includes(removed)) array.push(url);
					return array;
				}, []);
			} else {
				return null;
			}
		}
	},

	created() {
		if (this.$store.getters.isSignedIn) {
			this.connection = this.$root.stream;
		}

		if (this.detail) {
			this.$root.api('notes/children', {
				noteId: this.appearNote.id,
				limit: 30
			}).then(replies => {
				this.replies = replies;
			});

			if (this.appearNote.replyId) {
				this.$root.api('notes/conversation', {
					noteId: this.appearNote.replyId
				}).then(conversation => {
					this.conversation = conversation.reverse();
				});
			}
		}
	},

	mounted() {
		this.capture(true);

		if (this.$store.getters.isSignedIn) {
			this.connection.on('_connected_', this.onStreamConnected);
		}
	},

	beforeDestroy() {
		this.decapture(true);

		if (this.$store.getters.isSignedIn) {
			this.connection.off('_connected_', this.onStreamConnected);
		}
	},

	methods: {
		capture(withHandler = false) {
			if (this.$store.getters.isSignedIn) {
				const data = {
					id: this.appearNote.id
				} as any;

				if (
					(this.appearNote.visibleUserIds || []).includes(this.$store.state.i.id) ||
					(this.appearNote.mentions || []).includes(this.$store.state.i.id)
				) {
					data.read = true;
				}

				this.connection.send('sn', data);
				if (withHandler) this.connection.on('noteUpdated', this.onStreamNoteUpdated);
			}
		},

		decapture(withHandler = false) {
			if (this.$store.getters.isSignedIn) {
				this.connection.send('un', {
					id: this.appearNote.id
				});
				if (withHandler) this.connection.off('noteUpdated', this.onStreamNoteUpdated);
			}
		},

		onStreamConnected() {
			this.capture();
		},

		onStreamNoteUpdated(data) {
			const { type, id, body } = data;

			if (id !== this.appearNote.id) return;

			switch (type) {
				case 'reacted': {
					const reaction = body.reaction;

					if (body.emoji) {
						const emojis = this.appearNote.emojis || [];
						if (!emojis.includes(body.emoji)) {
							emojis.push(body.emoji);
							Vue.set(this.appearNote, 'emojis', emojis);
						}
					}

					if (this.appearNote.reactions == null) {
						Vue.set(this.appearNote, 'reactions', {});
					}

					if (this.appearNote.reactions[reaction] == null) {
						Vue.set(this.appearNote.reactions, reaction, 0);
					}

					// Increment the count
					this.appearNote.reactions[reaction]++;

					if (body.userId == this.$store.state.i.id) {
						Vue.set(this.appearNote, 'myReaction', reaction);
					}
					break;
				}

				case 'unreacted': {
					const reaction = body.reaction;

					if (this.appearNote.reactions == null) {
						return;
					}

					if (this.appearNote.reactions[reaction] == null) {
						return;
					}

					// Decrement the count
					if (this.appearNote.reactions[reaction] > 0) this.appearNote.reactions[reaction]--;

					if (body.userId == this.$store.state.i.id) {
						Vue.set(this.appearNote, 'myReaction', null);
					}
					break;
				}

				case 'pollVoted': {
					const choice = body.choice;
					this.appearNote.poll.choices[choice].votes++;
					if (body.userId == this.$store.state.i.id) {
						Vue.set(this.appearNote.poll.choices[choice], 'isVoted', true);
					}
					break;
				}

				case 'deleted': {
					Vue.set(this.appearNote, 'deletedAt', body.deletedAt);
					Vue.set(this.appearNote, 'renote', null);
					this.appearNote.text = null;
					this.appearNote.fileIds = [];
					this.appearNote.poll = null;
					this.appearNote.cw = null;
					break;
				}
			}
		},

		reply(viaKeyboard = false) {
			pleaseLogin(this.$root);
			this.$root.post({
				reply: this.appearNote,
				animation: !viaKeyboard,
			}, () => {
				this.focus();
			});
		},

		renote() {
			pleaseLogin(this.$root);
			this.blur();
			this.$root.new(DpRenotePicker, {
				source: this.$refs.renoteButton,
				note: this.appearNote,
			}).$once('closed', this.focus);
		},

		renoteDirectly() {
			(this as any).$root.api('notes/create', {
				renoteId: this.appearNote.id
			});
		},

		react(viaKeyboard = false) {
			pleaseLogin(this.$root);
			this.blur();
			const picker = this.$root.new(DpReactionPicker, {
				source: this.$refs.reactButton,
				showFocus: viaKeyboard,
			});
			picker.$once('chosen', reaction => {
				this.$root.api('notes/reactions/create', {
					noteId: this.appearNote.id,
					reaction: reaction
				}).then(() => {
					picker.close();
				});
			});
			picker.$once('closed', this.focus);
		},

		reactDirectly(reaction) {
			this.$root.api('notes/reactions/create', {
				noteId: this.appearNote.id,
				reaction: reaction
			});
		},

		undoReact(note) {
			const oldReaction = note.myReaction;
			if (!oldReaction) return;
			this.$root.api('notes/reactions/delete', {
				noteId: note.id
			});
		},

		favorite() {
			pleaseLogin(this.$root);
			this.$root.api('notes/favorites/create', {
				noteId: this.appearNote.id
			}).then(() => {
				this.$root.dialog({
					type: 'success',
					iconOnly: true, autoClose: true
				});
			});
		},

		del() {
			this.$root.dialog({
				type: 'warning',
				text: this.$t('noteDeleteConfirm'),
				showCancelButton: true
			}).then(({ canceled }) => {
				if (canceled) return;

				this.$root.api('notes/delete', {
					noteId: this.appearNote.id
				});
			});
		},

		menu(viaKeyboard = false) {
			if (this.openingMenu) return;
			this.openingMenu = true;
			const w = this.$root.new(DpNoteMenu, {
				source: this.$refs.menuButton,
				note: this.appearNote,
				animation: !viaKeyboard
			}).$once('closed', () => {
				this.openingMenu = false;
				this.focus();
			});
		},

		toggleShowContent() {
			this.showContent = !this.showContent;
		},

		focus() {
			this.$el.focus();
		},

		blur() {
			this.$el.blur();
		},

		focusBefore() {
			focus(this.$el, e => e.previousElementSibling);
		},

		focusAfter() {
			focus(this.$el, e => e.nextElementSibling);
		}
	}
});
</script>

<style lang="scss" scoped>
@import '../theme';

.note {
	> .article {
		display: flex;
		// padding: 28px 32px 18px;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 100%;

		@media (max-width: 450px) {
			// padding: 14px 16px 9px;
		}

		> .files {
			width: 100%;
			height: 100%;

			> img {
				display: block;
				max-width: 100%;
			}
		}
	}
}
</style>
