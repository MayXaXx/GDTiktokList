import { round, score } from './score.js';

const dir = '/data';

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchPacks() {
    try {
        const packsResult = await fetch(`${dir}/_packs.json`);
        const packs = await packsResult.json();

        const listResult = await fetch(`${dir}/_list.json`);
        const listOrder = await listResult.json();

        return await Promise.all(
            packs.map(async (pack) => {
                const levels = await Promise.all(
                    pack.levels.map(async (path) => {
                        try {
                            const res = await fetch(`${dir}/${path}.json`);
                            const level = await res.json();
                            const index = listOrder.indexOf(path);
                            return { ...level, path, index };
                        } catch {
                            console.error(`Failed to load pack level: ${path}`);
                            return null;
                        }
                    })
                );
                return {
                    ...pack,
                    resolvedLevels: levels.filter(Boolean)
                };
            })
        );
    } catch {
        console.error('Failed to load packs.');
        return null;
    }
}

export function calculatePackBonus(pack, list) {
    const total = pack.resolvedLevels.reduce((sum, level) => {
        const entry = list.find(([lvl]) => lvl?.path === level.path);
        if (!entry) return sum;
        const rank = list.indexOf(entry) + 1;
        return sum + score(rank, 100, level.percentToQualify);
    }, 0);
    return round(total / pack.resolvedLevels.length / 2);
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

export async function fetchLeaderboard() {
    const list = await fetchList();

    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === level.verifier.toLowerCase(),
        ) || level.verifier;
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
            packs: [],
        };
        const { verified } = scoreMap[verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        level.records.forEach((record) => {
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
                packs: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    // Pack bonuses
    const packs = await fetchPacks();
    if (packs) {
        packs.forEach((pack) => {
            const packLevelPaths = pack.resolvedLevels.map(l => l.path);
            const bonus = calculatePackBonus(pack, list);

            Object.entries(scoreMap).forEach(([user, scores]) => {
                const userPaths = [
                    ...scores.verified.map(v => {
                        const entry = list.find(([lvl]) => lvl?.name === v.level);
                        return entry?.[0]?.path;
                    }),
                    ...scores.completed.map(c => {
                        const entry = list.find(([lvl]) => lvl?.name === c.level);
                        return entry?.[0]?.path;
                    }),
                ].filter(Boolean);

                const completedAll = packLevelPaths.every(path =>
                    userPaths.includes(path)
                );

                if (completedAll) {
                    scores.packs.push({
                        name: pack.name,
                        icon: pack.icon,
                        score: bonus,
                    });
                }
            });
        });
    }

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed, packs } = scores;
        const total = [verified, completed, progressed, packs]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}
