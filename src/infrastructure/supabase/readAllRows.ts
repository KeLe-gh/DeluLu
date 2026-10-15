interface IdentifiedRow {
    id: string
}

interface PageResult<T> {
    data: T[] | null
    error: unknown
}

export async function readAllRows<T extends IdentifiedRow>(
    readPage: (
        afterId: string | null,
        pageSize: number,
    ) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
    const rows: T[] = []
    const pageSize = 500
    let afterId: string | null = null

    while (true) {
        const { data, error } = await readPage(afterId, pageSize)

        if (error) {
            throw error
        }

        if (data === null) {
            throw new Error(
                'Die Daten konnten nicht geladen werden.',
            )
        }

        const lastRow = data[data.length - 1]

        if (!lastRow) {
            return rows
        }

        if (lastRow.id === afterId) {
            throw new Error(
                'Das Laden der Daten konnte nicht fortgesetzt werden.',
            )
        }

        rows.push(...data)
        afterId = lastRow.id
    }
}