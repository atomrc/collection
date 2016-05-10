
import {run} from '@cycle/core';
import {makeDOMDriver, div, button, input} from '@cycle/dom';
import Rx, {Observable} from 'rx';
import Collection from '../../src/collection';
import assert from 'assert';
import $ from 'jquery';
import simulant from 'simulant';

function createRenderTarget () {
   const element = document.createElement('div');
   element.className = 'cycletest';
   document.body.appendChild(element);
   return element;
 }

function runStep (step, steps, previousResult) {
  setTimeout(() => {
    const result = step(previousResult);

    const next = steps[1];

    if (next) {
      runStep(next, steps.slice(1), result);
    }

  }, 1);
}

function runSteps (steps) {
  runStep(steps[0], steps);
}


function Friend ({DOM, props$}) {
  const dismiss$ = DOM
    .select('.dismiss')
    .events('click');

  return {
    DOM: props$.map(props => (
      div('.friend', [
        props.name,
        button('.dismiss', 'x')
      ])
    )),

    dismiss$,

    state$: props$
  }
}

function addFriend (name) {
  return function addFriendInner (state) {
    return {
      ...state,

      friends: state.friends.add({name})
    }
  };
}

function FriendsList ({DOM}) {
  const friends = Collection(Friend, {DOM}, {
    dismiss$: function dismiss (state, dismissedFriend, event) {
      return {
        ...state,

        friends: state.friends.remove(dismissedFriend)
      }
    }
  })

  const initialState = {
    friends
  }

  const friendName$ = DOM
    .select('.friend-name')
    .events('change')
    .map(ev => ev.target.value)

  const addFriend$ = DOM
    .select('.add-friend')
    .events('click')
    .withLatestFrom(friendName$, (_, friendName) => addFriend(friendName));

  const action$ = Observable.merge(
    addFriend$,
    friends.action$
  )

  const state$ = action$
    .startWith(initialState)
    .scan((state, action) => action(state));

  return {
    DOM: state$.map(state => (
      div('.friends', [
        input('.friend-name'),
        button('.add-friend', 'Add friend'),
        ...state.friends.asArray().map(friend => friend.DOM)
      ])
    )),

    state$
  }
}

describe('friends', () => {
  it('removes items normally', (done) => {
    const container = createRenderTarget();

    const drivers = {
      DOM: makeDOMDriver(container)
    };

    const steps = [
      () => {
        run(FriendsList, drivers);
      },

      () => {
        const friendNameField = $(".friend-name")[0];
        const addFriendField = $(".add-friend")[0];

        $(".friend-name").val('cesar');
        simulant.fire(friendNameField, 'change');
        simulant.fire(addFriendField, 'click');

        $(".friend-name").val('marianne');
        simulant.fire(friendNameField, 'change');
        simulant.fire(addFriendField, 'click');

        $(".friend-name").val('octavio');
        simulant.fire(friendNameField, 'change', {value: 'octavio'});
        simulant.fire(addFriendField, 'click');
      },

      () => {
        assert.deepEqual(
          ["cesarx", "mariannex", "octaviox"],
          $(".friend").toArray().map(friend => $(friend).text())
        )
      },

      () => {
        const removeMarianne = $('.dismiss')[1];

        simulant.fire(removeMarianne, 'click');

        assert.deepEqual(
          ["cesarx", "octaviox"],
          $(".friend").toArray().map(friend => $(friend).text())
        )

        done();
      }
    ]

    runSteps(steps);
  });
});
