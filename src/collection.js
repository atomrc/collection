import {Subject, Observable} from 'rx';
import isolate from '@cycle/isolate';

let _id = 0;

function id() {
  return _id++;
};

function handlerStreams (component, item, handlers) {
  const sinkStreams = Object.keys(item).map(sink => {
    if (handlers[sink] === undefined) {
      return null;
    }

    const handler = handlers[sink];
    const sink$ = item[sink];

    return sink$.map(event => {
      event.stopPropagation && event.stopPropagation();

      const handlerAction = (state) => handler(state, item, event);

      return handlerAction;
    });
  });

  return Observable.merge(...sinkStreams.filter(action => action !== null));
}

function makeItem (component, sources, props) {
  const newId = id();

  if (props) {
    sources['props$'] = Observable.just(props);
  }

  const newItem = isolate(component, newId.toString())(sources);

  newItem.id = newId;

  return newItem;
}

export default function Collection (component, sources, handlers = {}, items = [], action$ = new Subject, subscriptions = {}) {
  return {
    add (props) {
      const newItem = makeItem(component, sources, props);

      const subscription = handlerStreams(component, newItem, handlers)
        .subscribe((action) => action$.onNext(action));

      return Collection(
        component,
        sources,
        handlers,
        [...items, newItem],
        action$,
        {...subscriptions, [newItem.id]: subscription}
      )
    },

    remove (itemForRemoval) {
      subscriptions[itemForRemoval.id].dispose();
      delete subscriptions[itemForRemoval.id];

      return Collection(
        component,
        sources,
        handlers,
        items.filter(item => item.id !== itemForRemoval.id),
        action$,
        subscriptions
      )
    },

    asArray () {
      return items;
    },

    action$: action$.asObservable()
  }
}
