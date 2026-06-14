import { fetchPacks } from '../content.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-packs">
            <div class="packs-container">
                <div
                    class="pack-card"
                    v-for="pack in packs"
                    :key="pack.id"
                    :style="{ borderColor: pack.color }"
                >
                    <div class="pack-header">
                        <span class="pack-icon">{{ pack.icon }}</span>
                        <div>
                            <h2>{{ pack.name }}</h2>
                            <p class="pack-desc">{{ pack.description }}</p>
                        </div>
                    </div>
                    <ul class="pack-levels">
                        <li
                            v-for="level in pack.resolvedLevels"
                            :key="level.id"
                            class="pack-level-chip"
                            :style="{ borderColor: pack.color }"
                        >
                            {{ level.name }}
                        </li>
                    </ul>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        packs: [],
        loading: true,
    }),
    async mounted() {
        this.packs = await fetchPacks();
        this.loading = false;
    },
};
