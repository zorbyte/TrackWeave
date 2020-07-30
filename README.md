# TrackWeave - Ramifiable and Directed Transactions

TrackWeave is the Ramifiable and Directed Transactions (RDT) data structure,
a new and intuitive way to link Arweave transactions through chronology,
linked subtrees, and branches.

RDT is a hybrid data structure that aggregates the chronology of a
[linked list](https://en.wikipedia.org/wiki/Linked_list),
the ramifiability of
[tree structures](<https://en.wikipedia.org/wiki/Tree_(data_structure)>),
and the versatility of
[graph structures](<https://en.wikipedia.org/wiki/Graph_(data_structure)>).
This allows one to traverse along a chronological chain of transactions in a
bidirectional manner, while still retaining the successive and directed nature
of a blockchain. The RDT data structure also supports branches, which allows,
through a simple transaction, the ability to continue a chain independently
and then conclude the chain my rejoining it with the origin RST later. The nature
of branches allows one to create cyclic graphs, however, to remain true to the
ideals of a directed blockchain, a rejoin can not be associated to a node that
existed prior to the creation of a branch. Branches open a myriad of
opportunities for your transactions through the relationships that can be
expressed with their cyclic ability. In addition to branches, RDT supports 
"subtrees," which allow you to link an independent RDT to a node that exists
elsewhere. What sets apart a subtree from a fork is that an RDT that is referenced
by a subtree is oblivious to the subtree in question, however, the subtree can
utilise the other RDT that it references as a means to collect further data
through traversal. As a result, independent ecosystems can integrate external
data into themselves with ease.

## RDT Specification

> Notes:
> Terminology relating to tree structures is used in conjunction with graph
> terminology in this specification.
> RDT uses [nanoids](https://github.com/ai/nanoid) for its random strings.

### Key

A **new** random number is denoted by `R`.

A number is denoted by `N`.

Data that is replicated from a previous node at the same tag is
prefixed with `<-`

Tags in the format `Tag?: Data` represent optional tags.

### The root node

To create a RDT structure, a root node must be configured with
the following tags:

```
# An easy way to indicate that this is the root. Useful for ArQL.
RDT-Type: "Root"
RDT-Version?: [Currently, 0.0.5]

Root-Id: R
Created-At: [UNIX Timestamp]
Edge-Head: R
# You can initialise your own subtree through this value.
Edge-Tail?: <-R
```

### Regular Nodes

Regular transactions that you wish to participate as a node in the RDT
are configured with the following tags:

```
RDT-Type: "Node"
RDT-Version?: [Currently, 0.0.5]

Root-Id: <-R
Created-At: [UNIX Timestamp]
Edge-Head: [R OR See Rejoining a branch]
Edge-Tail: <-R

# Use 0 if the degree of the tree is 0.
Branch-Depth: <-N OR 0 OR <-N + 1
# When a branch is made, the value should be set to Edge-Tail
# After that, additional nodes should use the previous Branch-Edge-Tail
Branch-Edge-Tail?: [<-Branch-Edge-Tail OR Value of Edge-Tail]

# A waypoint is a means of quickly jumping around the chain
# if you're stuck in an undesirable location.
# When the degree of the tree is 0, the first waypoint is
# instantiated with both Waypoint-Tail and Waypoint-Head
# being assigned to an R. The waypoint values do not change
# unless you want to create a new waypoint.To create a new
# waypoint, set the value of Waypoint-Tail to the previous
# Waypoint-Head, and set the value the Waypoint-Head to an R.
Waypoint-Tail: [<-R OR Previous Waypoint-Head OR R]
Waypoint-Head: [<-R OR R]
```

## Branches

Branching a RDT is rather trivial, as you just continue the RDT, but you add
1 to the branch depth. Adding or subtracting more than 1 to the branch depth
will make it invalid, and the branch will be ignored. When a branch is created,
its waypoint will be reset to reflect the root of the branch.

### Querying branches

Querying a branch can be achieved by using the following tags:

```
RDT-Type: "Node"
Root-Id: [Current Root-Id]
Branch-Depth: [Branch-Depth + 1]
Edge-Tail: [Current Branch-Head]
```

### Rejoining a branch

To rejoin with the chain of the ancestral origin of a branch, any transaction of
that chain that outdates the `Branch-Edge-Tail` or is equal to it needs to be
used as the `Edge-Head`. If you attempt to rejoin to a node that predates the
`Branch-Edge-Tail`, the rejoin will be ignored by the traversal algorithm.

### Querying for rejoins

Every time a node is added to the chain, it should check if a branch has been
merged. The following tags will aid this:

```
RDT-Type: "Node"
Root-Id: [Current Root-Id]
Branch-Depth: [Branch-Depth + 1]
Branch-Edge-Tail: [Branch-Edge]
Edge-Head: [Desired Edge-Head]
```

## Subtrees

A subtree is similar to a branch, but is useful for different things. A branch
allows an insertion of alternative history before potentially migrating to the
latest head of the chain of its ancestral origin (rejoining).

A subtree is the same as starting a new RDT, however in reference to a previous
node. This is useful if you wish to demonstrate that there is a relationship
with a node that exists elsewhere and the genesis of a new RDT.

Creating a subtree is exactly the same as creating a root node, however the
`Edge-Tail` tag is utilised in order to make a one way reference to the
external RDT structure.

## Structural Integrity Checks

### Duplicate Nodes

If a node appears with duplicate data, an ArQL query will rank them based on
their chronology, thus allowing us to determine that the the proceeding entries
are invalid; these entries will be ignored.

### Incorrectly configured edges

Say we have tx1 with `Edge-Tail: foo` and `Edge-Head: bar` and tx2 was added
after tx1 with `Edge-Tail: bar` and `Edge-Head: foo`. This situation would
cause an infinite loop, and such behaviour is only supported in branches
although without the deadlocking behaviour. As such, unix time stamps sourced
from the `Created-At` tag are employed to ensure that transactions that are added in
the future do not match their `Edge-Head` to an older `Edge-Tail`.

## Todo List

- Write a library for TackWeave interactions in TypeScript.

## Inspirations

- [Linked Lists](https://en.wikipedia.org/wiki/Linked_list)
- [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph)

## License

The contents of this repository is licensed under the MIT license,
the copy of which pertaining to this repository is accessible at
[`./LICENSE`](./LICENSE).
