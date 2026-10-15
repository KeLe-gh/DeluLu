export class RevisionConflictError extends Error {
    constructor() {
        super('The stored record has changed.')
        this.name = 'RevisionConflictError'
    }
}