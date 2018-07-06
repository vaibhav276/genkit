import * as _ from 'underscore';

export enum EvalType {
    ET_COST,
    ET_FITNESS
}

export type Config = {
    dnaCodes: Array<any>,
    evalType: EvalType,
    evalFn: Function,
    mutate: Function,
    mate: Function
}

export type Gene = {
    code: Array<any>,
    score: number,
    fitness: number,
    cost: number
}

export type Population = {
    elements: Array<Gene>,
    generation: number
}

/** Generate a new random population
 *  Used for initialization
 */
export let randomPopulation = (config: Config, len: number, popSize: number): Population => {
    return {
        elements: _.times(popSize, () => randomGene(config, len)),
        generation: 0
    }
}

/** Generate a random gene sequence */
export let randomGene = (config: Config, len: number): Gene => {
    return {
        code: _.sample<Array<any>>(config.dnaCodes, len),
        score: undefined,
        fitness: undefined,
        cost: undefined
    };
}

/** Calculate normalized (0-1) score from cost range of population */
export let score = (config: Config, population: Population): Population => {
    if (config.evalType === EvalType.ET_COST) {
        let costed: Array<Gene> = _.map(population.elements, (e) => {
            e.cost = config.evalFn(e.code);
            return e;
        });
        let minCostGene: Gene = _.min<Gene>(costed, (e) => e.cost);
        let maxCostGene: Gene = _.max<Gene>(costed, (e) => e.cost);
        let range: number = (maxCostGene.cost - minCostGene.cost) || 1; // Prevent divide by zero
        // when all elements are the same

        let scored: Array<Gene> = _.map(costed, (e) => {
            e.score = 1.0 - ( (e.cost - minCostGene.cost) / range );
            return e;
        });
        let newPopulation: Population = _.clone(population); // TODO: better cloning?
        newPopulation.elements = scored;
        return newPopulation;

    } else if (config.evalType === EvalType.ET_FITNESS) {
        let scored: Array<Gene> = _.map(population.elements, (e) => {
            e.fitness = config.evalFn(e.code);
            e.score = e.fitness;
            return e;
        });
        let newPopulation: Population = _.clone(population); // TODO: better cloning?
        newPopulation.elements = scored;
        return newPopulation;
    }
    fail("Unexpected evalType");
}

/** Pick a random parent, based on giving higher chance
 *  to elements having higher score
 */
let pickParent = (population: Population): Gene => {
    // NOTE: population must be scored already
    // TODO: How to assert?

    let minScoreGene: Gene = _.min<Gene>(population.elements, (e) => e.score);
    let maxScoreGene: Gene = _.max<Gene>(population.elements, (e) => e.score);
    let potentialParent: Gene = _.sample<Gene>(population.elements);
    if (minScoreGene.score === maxScoreGene.score) {
        return potentialParent;
    }
    // Accept-reject mechanism
    // https://www.wikiwand.com/en/Rejection_sampling
    while (true) {
        if (potentialParent.score > Math.random()) {
            return potentialParent;
        }
        potentialParent = _.sample<Gene>(population.elements);
    }
    fail("Unexpected code flow");
}

/** Mutate, or not */
let maybeMutate = (config: Config, gene: Gene, chance: number): Gene => {
    if (Math.random() > chance) return gene;

    let index: number = _.random(gene.code.length - 1);
    let res: Gene = _.clone(gene);
    res.code[index] = config.mutate(res.code[index],
                                    config.dnaCodes);
    return res;
}

/** Mate two genes */
let mateWrapper = (config: Config, gene1: Gene, gene2: Gene): Gene => {
    let res: Gene = _.clone(gene1);
    res.code = config.mate(gene1.code, gene2.code);
    return res;
}

/** Evolve population to its next generation */
export let evolve = (config: Config, population: Population, mutationRate: number): Population => {
    let children: Array<Gene> = [];

    // Next generation's population count is same as current
    while(children.length < population.elements.length) {
        children.push(_.compose((gene) => {
            return gene;
        }, (gene) => {
            return maybeMutate(config,
                               gene,
                               mutationRate)
        }, () => {
            return mateWrapper(config,
                               pickParent(population),
                               pickParent(population));
        })());
    }
    let res: Population = _.clone(population); // TODO: better cloning?
    res.generation = population.generation + 1;
    res.elements = children;

    return res;
}

let fail = (message: string): never => { throw new Error(message); }
