# Priority Todo Work Flow

この文書は、Priority Todo リポジトリで AI エージェントが実装作業を行うときの標準ワークフローを定義する。

このリポジトリは Priority Todo を対象とする。別プロジェクト固有の前提は持ち込まない。他リポジトリのパス、ブランチ、Pull Request、成果物を Priority Todo の作業根拠として参照しない。

## Core Rule

作業はフェーズに分ける。フェーズとは、ユーザーが確認できる明確な成果を持つマイルストーンである。

次の条件を満たすまで、次のフェーズへ進まない。

1. フェーズの作業が commit / push 済みである。
2. `YYYY-MM-DD HH:mm JST` のタイトルマーカーを含む Pull Request、または同等の merge point が作成されている。
3. 作業が `main` にマージされている。
4. ローカル `main` が `origin/main` と同期されている。
5. 作業報告が完了している。
6. ユーザーが結果を確認している。
7. ユーザーがフェーズ OK、または次の指示を出している。

## Discussion-Only Mode

ユーザーが `議論のみ`、`相談のみ` と言った場合、または明確に相談だけを求めている場合は、ファイル編集、commit、push、PR 作成をしない。

議論のみモードでは次の範囲にとどめる。

- 必要な場合のみ調査する。
- 調査結果を要約する。
- 質問に答える、または確認すべき点を質問する。
- リポジトリ状態を変更しない。

## Phase Flow

各フェーズは次の順序で進める。

1. 現在の Git 状態と canonical remote を確認する。
2. 日付入りの作業ブランチを作成、または使用する。
3. フェーズを小さなタスクへ分解する。
4. タスクを 1 つずつ実装する。
5. タスクごとに必要な検証を行う。
6. 有用な区切りでは commit / push して rollback point を残す。
7. フェーズ全体を完了する。
8. フェーズ全体の検証を行う。
9. フェーズ結果を commit / push する。
10. 日付、時刻、`JST` を含む Pull Request を作成、または更新する。
11. Pull Request を `main` にマージする。
12. ローカル `main` を `origin/main` と同期する。
13. 変更内容、検証内容、PR、最終 `main` commit を報告する。
14. 次フェーズへ進まず、ユーザー確認を待つ。

推奨ブランチパターン:

```text
ai/YYYY-MM-DD-short-description
```

## Task Flow Inside a Phase

フェーズ内のタスクごとにユーザー確認は不要だが、復帰できる地点を残す。

意味のあるタスクでは次を守る。

1. 変更範囲を絞る。
2. 変更内容を検証する。
3. 分かりやすい message で commit する。
4. 作業ブランチを push する。
5. rollback point が識別しやすくなる場合は、commit message、Pull Request、または更新メモに日付と時刻を含める。

## Rollback Requirement

各フェーズと意味のあるタスクは、Git 上の復帰点を残す。

推奨 rollback 方法:

- commit を revert する。
- push 済みブランチの以前の commit に戻る。
- 修正 commit を追加する。

破壊的な履歴操作は避ける。force push はしない。`git reset --hard` はユーザーが明示的に依頼した場合のみ使う。

## User Review Gate

フェーズ完了後は、作業を止めてユーザー確認を待つ。

報告には次を含める。

- push 済みブランチ
- タスクまたはフェーズの commit
- `YYYY-MM-DD HH:mm JST` を含む Pull Request、または merge point
- 最終 `main` commit
- 実施した検証
- ユーザーに確認してほしい内容

`main` へのマージは、通常のフェーズ完了フローに含める。ユーザーが特定タスクでレビュー前停止を求めた場合だけ、push や PR 作成時点で止める。

## Specification Uncertainty Gate

仕様書や指示は常に最終版とは限らない。実装中に仕様の不足、曖昧さ、矛盾、または誤りの可能性が見つかった場合は、きれいな区切りで停止する。

その場合は次の順序で対応する。

1. 部分作業を完了、または戻して、リポジトリを整合した状態にする。
2. 有用な完了済み作業があれば commit / push する。
3. 不確実な点を報告する。
4. ユーザーに方針を確認する。
5. ユーザーが明示的に実装再開を指示するまでは、次のステップを議論として扱う。

これはフェーズの途中でも適用する。

## Push and Pull Request Policy

デフォルトでは、ユーザーが `議論のみ` または push しないよう明示しない限り、commit / push / PR 作成 / merge / local main 同期まで進める。

原則:

- 日付入りブランチへ push する。
- Pull Request を作成、または更新する。
- Pull Request title には日付、時刻、`JST` を含める。
- 作業は Pull Request 経由で `main` にマージする。
- マージ後、ローカル `main` を `origin/main` と同期する。
- `main` へ直接 push しない。
- force push しない。

推奨 Pull Request title パターン:

```text
YYYY-MM-DD HH:mm JST: short description
```

例:

```text
2026-05-15 12:34 JST: docs add phase workflow policy
```

## Cross-Chat and Cross-Repository Use

今後のチャットや他リポジトリで実装作業を行う場合も、ユーザーが別の指示を出していなければ、このワークフローを標準の協業パターンとして扱う。

ただし、対象リポジトリに `AGENTS.md`、`CLAUDE.md`、`WORKFLOW.md` などのより強いローカルルールがある場合は、そのルールを優先し、矛盾しない範囲でこのワークフローを適用する。
